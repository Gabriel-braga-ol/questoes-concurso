import catalogData from "@/data/catalog.json";
import metaData from "@/data/meta.json";
import type { CatalogEntry, Meta } from "./types";

/**
 * O catálogo é importado direto (e não via fetch) de propósito: ele precisa
 * estar disponível no primeiro render para o filtro ser instantâneo, sem
 * estado de loading. Com ~900 questões isso custa poucas dezenas de KB
 * comprimidos — barato perto da sensação de velocidade que ganhamos.
 *
 * A ordem é intercalada por matéria: ordenar só por ano faria a primeira
 * tela mostrar 40 questões seguidas de Linguagens do mesmo ano, que parece
 * um acervo menor do que é.
 */
export const catalog: CatalogEntry[] = interleaveBySubject(catalogData as CatalogEntry[]);
export const meta = metaData as Meta;

export const UNCLASSIFIED = "Geral";

function interleaveBySubject(entries: CatalogEntry[]): CatalogEntry[] {
  const groups = new Map<string, CatalogEntry[]>();

  for (const entry of [...entries].sort(
    (a, b) => b.year - a.year || a.index - b.index,
  )) {
    const group = groups.get(entry.subject);
    if (group) group.push(entry);
    else groups.set(entry.subject, [entry]);
  }

  // matéria com mais questões primeiro: é o que o visitante tem mais chance
  // de querer ver
  const buckets = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR"))
    .map(([, group]) => group);

  const out: CatalogEntry[] = [];
  for (let round = 0; out.length < entries.length; round++) {
    for (const bucket of buckets) {
      const entry = bucket[round];
      if (entry) out.push(entry);
    }
  }
  return out;
}

export function subjectCounts(entries: CatalogEntry[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.subject, (counts.get(entry.subject) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

export function topicCounts(
  entries: CatalogEntry[],
  subject: string | null,
): { name: string; count: number }[] {
  const scoped = subject ? entries.filter((e) => e.subject === subject) : entries;
  const counts = new Map<string, number>();
  for (const entry of scoped) {
    counts.set(entry.topic, (counts.get(entry.topic) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    // "Geral" sempre por último: é o balde de não classificados
    .sort((a, b) => {
      if (a.name === UNCLASSIFIED) return 1;
      if (b.name === UNCLASSIFIED) return -1;
      return b.count - a.count || a.name.localeCompare(b.name, "pt-BR");
    });
}

export function years(entries: CatalogEntry[]): number[] {
  return [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a);
}

export function searchEntries(entries: CatalogEntry[], query: string): CatalogEntry[] {
  const needle = normalize(query);
  if (!needle) return entries;
  return entries.filter((entry) =>
    normalize(
      `${entry.preview} ${entry.subject} ${entry.topic} ${entry.year} ${entry.index} ${entry.areaLabel}`,
    ).includes(needle),
  );
}

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function topicLabel(topic: string): string {
  return topic === UNCLASSIFIED ? "Outros temas" : topic;
}
