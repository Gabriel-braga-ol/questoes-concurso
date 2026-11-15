/**
 * Ingestão das questões do ENEM a partir da API pública api.enem.dev.
 *
 * Uso:
 *   node scripts/ingest-enem.mjs                 # anos padrão (2019-2023)
 *   node scripts/ingest-enem.mjs 2020 2021 2022  # anos específicos
 *
 * O que ele faz:
 *   1. baixa todas as questões de cada ano (a API limita 50 por página)
 *   2. baixa as imagens para public/img/enem/<ano>/ (nada de hotlink)
 *   3. classifica matéria/assunto (ver scripts/topics.mjs)
 *   4. gera src/data/questions.json (completo) e src/data/catalog.json (lista enxuta)
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { classify } from "./topics.mjs";

const API = "https://api.enem.dev/v1";
const DEFAULT_YEARS = [2019, 2020, 2021, 2022, 2023];
const PAGE_SIZE = 50;

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const IMG_ROOT = path.join(ROOT, "public", "img", "enem");

const years = process.argv.slice(2).map(Number).filter(Boolean);
const targetYears = years.length ? years : DEFAULT_YEARS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    await sleep(400 * attempt);
    return fetchJson(url, attempt + 1);
  }
}

async function fetchQuestions(year) {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchJson(
      `${API}/exams/${year}/questions?limit=${PAGE_SIZE}&offset=${offset}`,
    );
    all.push(...page.questions);
    if (!page.metadata?.hasMore) break;
  }
  return all;
}

/* ------------------------------------------------------------------ */
/* imagens                                                             */
/* ------------------------------------------------------------------ */

const imageCache = new Map();

const EXT_BY_TYPE = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

function isBroken(url) {
  return !url || url.includes("broken-image.svg");
}

async function localizeImage(url, year) {
  if (isBroken(url)) return null;
  if (imageCache.has(url)) return imageCache.get(url);

  const promise = (async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
        const ext = EXT_BY_TYPE[type] ?? path.extname(new URL(url).pathname) ?? ".png";
        const name = createHash("sha1").update(url).digest("hex").slice(0, 12) + ext;
        const dir = path.join(IMG_ROOT, String(year));
        await mkdir(dir, { recursive: true });
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(path.join(dir, name), buf);
        return `/img/enem/${year}/${name}`;
      } catch (err) {
        if (attempt === 3) {
          console.warn(`  ! imagem falhou: ${url} (${err.message})`);
          return null;
        }
        await sleep(300 * attempt);
      }
    }
    return null;
  })();

  imageCache.set(url, promise);
  return promise;
}

/* ------------------------------------------------------------------ */
/* normalização                                                        */
/* ------------------------------------------------------------------ */

const AREA_LABEL = {
  matematica: "Matemática",
  "ciencias-natureza": "Ciências da Natureza",
  "ciencias-humanas": "Ciências Humanas",
  linguagens: "Linguagens e Códigos",
};

function cleanMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** troca imagens markdown por caminhos locais (ou remove as quebradas) */
async function rewriteMarkdownImages(markdown, year) {
  if (!markdown) return "";
  const tokens = [
    ...markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g),
  ];
  let out = markdown;
  for (const [full, alt, url] of tokens) {
    const local = await localizeImage(url, year);
    out = out.replace(full, local ? `![${alt}](${local})` : "");
  }
  return cleanMarkdown(out);
}

function stripMarkdown(text) {
  return (text ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toPreview(text, max = 170) {
  const clean = stripMarkdown(text);
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

async function normalizeQuestion(raw) {
  const year = raw.year;
  const id = `enem-${year}-${raw.index}`;

  const context = await rewriteMarkdownImages(raw.context ?? "", year);
  const stem = await rewriteMarkdownImages(raw.alternativesIntroduction ?? "", year);

  const images = [];
  for (const url of raw.files ?? []) {
    const local = await localizeImage(url, year);
    if (!local) continue;
    // a API repete em `files` as mesmas imagens que já estão no markdown
    if (context.includes(local) || stem.includes(local)) continue;
    images.push(local);
  }

  const alternatives = [];
  for (const alt of raw.alternatives ?? []) {
    const text = cleanMarkdown(alt.text ?? "");
    const image = alt.file ? await localizeImage(alt.file, year) : null;
    if (!text && !image) continue;
    alternatives.push({ letter: alt.letter, text, image });
  }

  if (alternatives.length < 2) return null;

  const plainStem = stripMarkdown(stem);
  const plainContext = stripMarkdown(context);
  const classification = classify({
    area: raw.discipline,
    language: raw.language ?? null,
    stem: plainStem,
    context: plainContext,
    alternatives: alternatives.map((a) => stripMarkdown(a.text)),
  });

  return {
    question: {
      id,
      exam: "ENEM",
      year,
      index: raw.index,
      area: raw.discipline,
      areaLabel: AREA_LABEL[raw.discipline] ?? raw.discipline,
      subject: classification.subject,
      topic: classification.topic,
      language: raw.language ?? null,
      context,
      stem,
      images,
      alternatives,
      correct: raw.correctAlternative ?? null,
      // o site de origem não expõe URL por questão; guardamos a raiz da fonte
      sourceUrl: "https://enem.dev",
    },
    catalog: {
      id,
      year,
      index: raw.index,
      area: raw.discipline,
      areaLabel: AREA_LABEL[raw.discipline] ?? raw.discipline,
      subject: classification.subject,
      topic: classification.topic,
      language: raw.language ?? null,
      preview: toPreview(plainStem || plainContext),
      hasImage: /!\[/.test(context) || images.length > 0 || alternatives.some((a) => a.image),
    },
  };
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

const questions = [];
const catalog = [];
const seen = new Set();
const stats = { downloaded: 0, skippedDuplicates: 0, skippedInvalid: 0 };

for (const year of targetYears) {
  process.stdout.write(`ENEM ${year}: baixando... `);
  const raw = await fetchQuestions(year);
  console.log(`${raw.length} questões`);

  for (const item of raw) {
    const id = `enem-${item.year}-${item.index}`;
    if (seen.has(id)) {
      stats.skippedDuplicates++;
      continue;
    }
    seen.add(id);

    try {
      const entry = await normalizeQuestion(item);
      if (!entry) {
        stats.skippedInvalid++;
        continue;
      }
      questions.push(entry.question);
      catalog.push(entry.catalog);
      stats.downloaded++;
    } catch (err) {
      stats.skippedInvalid++;
      console.warn(`  ! questão ${item.year}/${item.index}: ${err.message}`);
    }
  }
}

questions.sort((a, b) => b.year - a.year || a.index - b.index);
catalog.sort((a, b) => b.year - a.year || a.index - b.index);

await mkdir(DATA_DIR, { recursive: true });
await writeFile(path.join(DATA_DIR, "questions.json"), JSON.stringify(questions));
await writeFile(path.join(DATA_DIR, "catalog.json"), JSON.stringify(catalog));

const bySubject = {};
for (const q of catalog) bySubject[q.subject] = (bySubject[q.subject] ?? 0) + 1;

const meta = {
  generatedAt: new Date().toISOString(),
  source: "api.enem.dev (dados oficiais do INEP)",
  years: targetYears,
  total: questions.length,
  bySubject,
};
await writeFile(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2));

console.log("\n--- resumo ---");
console.log(`questões gravadas: ${stats.downloaded}`);
console.log(`duplicatas ignoradas: ${stats.skippedDuplicates}`);
console.log(`inválidas ignoradas: ${stats.skippedInvalid}`);
console.log("por matéria:", bySubject);
console.log("arquivos: src/data/questions.json, src/data/catalog.json, src/data/meta.json");
