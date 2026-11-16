/**
 * Ingestão das questões do ENEM a partir da API pública api.enem.dev.
 *
 * Uso:
 *   node scripts/ingest-enem.mjs                 # anos padrão (2019-2023)
 *   node scripts/ingest-enem.mjs 2020 2021 2022  # anos específicos
 *
 * O que ele faz:
 *   1. baixa todas as questões de cada ano em dois idiomas (a API limita 50 por
 *      página e só devolve inglês quando pedimos `language=ingles`)
 *   2. baixa as imagens para public/img/enem/<ano>/ (nada de hotlink)
 *   3. classifica matéria/assunto (ver scripts/topics.mjs)
 *   4. gera src/data/questions.json (completo), catalog.json (lista enxuta),
 *      meta.json (totais) e ingest-report.json (o que foi descartado e por quê)
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { classify } from "./topics.mjs";

const API = "https://api.enem.dev/v1";
const DEFAULT_YEARS = [2019, 2020, 2021, 2022, 2023];
const PAGE_SIZE = 50;

/**
 * As questões 1 a 5 do ENEM existem em duas versões, inglês e espanhol, com a
 * MESMA numeração. A API devolve só uma por consulta: sem filtro vem espanhol,
 * com `language=ingles` vem inglês. Sem as duas passadas o acervo fica sem
 * inglês e o id fica ambíguo, por isso o idioma entra no id.
 */
const LANGUAGES = [null, "ingles"];

/** versão da classificação por regras; a passada por LLM grava a dela */
const CLASSIFIER_VERSION = "regras@v1";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const IMG_ROOT = path.join(ROOT, "public", "img", "enem");

const years = process.argv.slice(2).map(Number).filter(Boolean);
const targetYears = years.length ? years : DEFAULT_YEARS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A API é pública e sem chave, e responde 429 com `Retry-After` — às vezes
 * pedindo mais de uma hora. Obedecer isso travava a CLI por 80 minutos, então
 * o pedido da API é tratado como sugestão com teto. Também há teto de tempo por
 * requisição: uma conexão pendurada não pode congelar a ingestão.
 */
const MAX_BACKOFF_MS = 60_000;
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 429 && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const suggested = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0;
      const wait = Math.min(suggested || 15_000 * attempt, MAX_BACKOFF_MS);
      console.warn(`  · limite da API, esperando ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      return fetchJson(url, attempt + 1);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 5) throw err;
    console.warn(`  · falha de rede (${err.message}), tentando de novo`);
    await sleep(1000 * attempt);
    return fetchJson(url, attempt + 1);
  }
}

async function fetchQuestions(year, language) {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = `limit=${PAGE_SIZE}&offset=${offset}` + (language ? `&language=${language}` : "");
    const page = await fetchJson(`${API}/exams/${year}/questions?${query}`);
    all.push(...page.questions);
    if (!page.metadata?.hasMore) break;
    await sleep(400);
  }
  return all;
}

/** chave de unicidade: o mesmo número existe em dois idiomas */
function languageKey(language) {
  return language ?? "sem-idioma";
}

function questionId(year, index, language) {
  const suffix = language === "ingles" ? "-en" : language === "espanhol" ? "-es" : "";
  return `enem-${year}-${index}${suffix}`;
}

/**
 * Assinatura do conteúdo. Serve para o caso em que a API devolve a mesma
 * questão nas duas passadas de idioma (2020/5 vem em espanhol até quando
 * pedimos inglês): sem isso o acervo ganha uma cópia com id diferente.
 */
function contentFingerprint(question) {
  const text = [
    question.context,
    question.stem,
    ...question.alternatives.map((alternative) => `${alternative.letter}${alternative.text}`),
  ].join("\n");
  return createHash("sha1").update(text).digest("hex");
}

/* ------------------------------------------------------------------ */
/* imagens                                                             */
/* ------------------------------------------------------------------ */

const imageCache = new Map();
/** nomes já baixados por ano: reingestão não rebaixa 33 MB de imagens */
const imageFiles = new Map();

async function imagesOf(year) {
  const key = String(year);
  if (!imageFiles.has(key)) {
    const dir = path.join(IMG_ROOT, key);
    const names = await readdir(dir).catch(() => []);
    imageFiles.set(key, new Set(names));
  }
  return imageFiles.get(key);
}

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
    const base = createHash("sha1").update(url).digest("hex").slice(0, 12);
    const files = await imagesOf(year);
    const cached = [...files].find((name) => name.startsWith(`${base}.`));
    if (cached) return `/img/enem/${year}/${cached}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
        const ext = EXT_BY_TYPE[type] ?? path.extname(new URL(url).pathname) ?? ".png";
        const name = base + ext;
        const dir = path.join(IMG_ROOT, String(year));
        await mkdir(dir, { recursive: true });
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(path.join(dir, name), buf);
        files.add(name);
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

async function normalizeQuestion(raw, language) {
  const year = raw.year;
  const id = questionId(year, raw.index, language);

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
    language,
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
      /** procedência da classificação: permite reprocessar sem adivinhar */
      classifiedBy: CLASSIFIER_VERSION,
      language,
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
      language,
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
const collected = new Set();
const contents = new Set();
const skipped = [];
const missingByYear = {};
/** itens que vêm em toda passada (6-180) e não são erro nem descarte */
const stats = { repeatedAcrossPasses: 0 };

/**
 * O idioma das questões 1-5 vem do campo `language` — menos em 2020, que
 * devolve `null` nas duas versões. Como a passada já diz qual edição foi
 * pedida, ela é a fonte da verdade para essas cinco.
 */
function resolveLanguage(item, passLanguage) {
  if (item.language) return item.language;
  return item.index <= 5 ? (passLanguage ?? "espanhol") : null;
}

/** descarta a questão e registra o motivo: sem isso o acervo tem buracos mudos */
function skip(year, item, language, reason) {
  skipped.push({
    id: questionId(year, item.index, language),
    year,
    index: item.index,
    language,
    reason,
  });
}

for (const year of targetYears) {
  const yearSeen = [];

  for (const passLanguage of LANGUAGES) {
    process.stdout.write(
      `ENEM ${year}${passLanguage ? ` (${passLanguage})` : ""}: baixando... `,
    );
    const raw = await fetchQuestions(year, passLanguage);
    console.log(`${raw.length} questões`);

    const inPass = new Set();

    for (const item of raw) {
      const language = resolveLanguage(item, passLanguage);
      const key = `${year}-${item.index}-${languageKey(language)}`;

      // a API repete um item no fim de uma página e no começo da seguinte
      if (inPass.has(key)) {
        skip(year, item, language, "repetida-na-api");
        continue;
      }
      inPass.add(key);

      // itens sem idioma (6-180) vêm nas duas passadas: já foram coletados
      if (collected.has(key)) {
        stats.repeatedAcrossPasses++;
        continue;
      }
      collected.add(key);

      try {
        const entry = await normalizeQuestion(item, language);
        if (!entry) {
          skip(year, item, language, "sem-alternativas-suficientes");
          continue;
        }

        const fingerprint = `${year}-${item.index}-${contentFingerprint(entry.question)}`;
        if (contents.has(fingerprint)) {
          skip(year, item, language, "conteudo-repetido-entre-idiomas");
          continue;
        }
        contents.add(fingerprint);

        questions.push(entry.question);
        catalog.push(entry.catalog);
        yearSeen.push(item.index);
      } catch (err) {
        skip(year, item, language, `erro: ${err.message}`);
        console.warn(`  ! questão ${year}/${item.index}: ${err.message}`);
      }
    }
  }

  // o enunciado do ENEM tem 180 questões; o que não veio da API não é bug nosso
  const presentes = new Set(yearSeen);
  missingByYear[year] = [];
  for (let index = 1; index <= 180; index++) {
    if (!presentes.has(index)) missingByYear[year].push(index);
  }
}

questions.sort((a, b) => b.year - a.year || a.index - b.index);
catalog.sort((a, b) => b.year - a.year || a.index - b.index);

await mkdir(DATA_DIR, { recursive: true });
await writeFile(path.join(DATA_DIR, "questions.json"), JSON.stringify(questions));
await writeFile(path.join(DATA_DIR, "catalog.json"), JSON.stringify(catalog));

const bySubject = {};
for (const q of catalog) bySubject[q.subject] = (bySubject[q.subject] ?? 0) + 1;

const byLanguage = {};
for (const q of questions) {
  const key = languageKey(q.language);
  byLanguage[key] = (byLanguage[key] ?? 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  years: [...targetYears].sort((a, b) => a - b),
  downloaded: questions.length,
  byLanguage,
  /** questões 6-180 que vieram nas duas passadas: esperado, não é descarte */
  repeatedAcrossPasses: stats.repeatedAcrossPasses,
  skipped,
  missingByYear,
};
await writeFile(
  path.join(DATA_DIR, "ingest-report.json"),
  JSON.stringify(report, null, 2),
);

const meta = {
  generatedAt: new Date().toISOString(),
  source: "api.enem.dev (dados oficiais do INEP)",
  years: [...targetYears].sort((a, b) => a - b),
  total: questions.length,
  bySubject,
  byLanguage,
};
await writeFile(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2));

console.log("\n--- resumo ---");
console.log(`questões gravadas: ${questions.length}`);
console.log(`descartadas: ${skipped.length}`);
for (const year of Object.keys(missingByYear)) {
  const missing = missingByYear[year];
  if (missing.length) console.log(`  ${year} sem questão na API: ${missing.join(", ")}`);
}
console.log("por idioma:", byLanguage);
console.log("por matéria:", bySubject);
console.log("arquivos: src/data/{questions,catalog,meta,ingest-report}.json");
