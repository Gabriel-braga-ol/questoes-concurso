/**
 * Classificação de matéria/assunto das questões com um LLM (Gemini), em lote.
 *
 * A ingestão grava a classificação por regras (`regras@v1`). Este script lê o
 * acervo já baixado, manda o texto das questões para o modelo com a taxonomia
 * fechada de `topics.mjs` e regrava matéria, assunto e a procedência em
 * `classifiedBy`. Nada é baixado da API do ENEM: rodar de novo custa só tokens.
 *
 * Uso:
 *   node scripts/classify-enem.mjs                 # classifica o que falta
 *   node scripts/classify-enem.mjs --limit 30 --dry  # amostra sem gravar
 *   node scripts/classify-enem.mjs --force          # reclassifica tudo
 *
 * A chave vem de GEMINI_API_KEY (ambiente) ou de `.env.local`. Ela nunca é
 * impressa nem vai para o repositório. Se uma questão vier fora da taxonomia
 * (ou o modelo esquecer o id), ela cai de volta nas regras e continua pendente
 * para uma próxima execução.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AREA_SUBJECTS, TOPIC_RULES, classify } from "./topics.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const PROMPT_VERSION = "prompt-v1";
const RULES_VERSION = "regras@v1";
const BATCH_SIZE = 20;
const MAX_CONTEXT = 1800;
const MAX_ALTERNATIVE = 160;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 5;

const API = "https://generativelanguage.googleapis.com/v1beta/models";

const AREA_LABEL = {
  matematica: "Matemática",
  "ciencias-natureza": "Ciências da Natureza",
  "ciencias-humanas": "Ciências Humanas",
  linguagens: "Linguagens e Códigos",
};

/** matéria -> área, para corrigir a área quando a API erra o rótulo */
const SUBJECT_AREA = new Map();
for (const [area, conf] of Object.entries(AREA_SUBJECTS)) {
  for (const subject of conf.candidates) SUBJECT_AREA.set(subject, area);
}

/** chave do ambiente ou do `.env.local`; nunca vai para o log */
async function readApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf8").catch(() => "");
  const match = raw.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)$/m);
  return match?.[1].trim().replace(/^["']|["']$/g, "") ?? null;
}

function parseArgs(argv) {
  const options = {
    limit: 0,
    dry: false,
    force: false,
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry") options.dry = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--limit" || arg.startsWith("--limit=")) {
      options.limit = Number(arg.includes("=") ? arg.split("=")[1] : argv[++i]) || 0;
    } else if (arg.startsWith("--model=")) {
      options.model = arg.split("=")[1];
    } else {
      throw new Error(`argumento desconhecido: ${arg}`);
    }
  }

  return options;
}

/** tira markdown/imagens do texto: o modelo só precisa do conteúdo */
function plain(text) {
  return (text ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function describeTaxonomy() {
  const lines = [];
  for (const [area, conf] of Object.entries(AREA_SUBJECTS)) {
    const subjects = conf.candidates.map((subject) => {
      const topics = [...Object.keys(TOPIC_RULES[subject] ?? {}), "Geral"];
      return `${subject}: ${topics.join("; ")}`;
    });
    lines.push(`- ${area}: ${subjects.join(" | ")}`);
  }
  return lines.join("\n");
}

function systemInstruction() {
  return `Você classifica questões do ENEM por matéria e assunto para um site de estudos.

Taxonomia fechada (área: matéria: assuntos permitidos):
${describeTaxonomy()}

Regras:
1. Escolha exatamente um assunto e uma matéria da taxonomia. A área informada veio da API e é só uma dica: em casos raros ela está errada.
2. Classifique pelo que a questão PEDE, não pelo tema do texto de apoio. Um texto sobre história que pede interpretação de gráfico é Geografia.
3. Em questão interdisciplinar, escolha a matéria cujo raciocínio resolve a questão.
4. Não use as matérias guarda-chuva "Ciências da Natureza" ou "Ciências Humanas".
5. "Geral" é o último recurso: use apenas se nenhum assunto específico servir.
6. Se a questão for de Inglês ou Espanhol, mantendo o idioma informado, use a matéria e o assunto de interpretação desse idioma.
7. Responda TODAS as questões recebidas, sem inventar ids, em JSON puro no formato:
[{"id":"...","subject":"...","topic":"..."}]`;
}

function questionPayload(question) {
  return {
    id: question.id,
    area: question.area,
    language: question.language,
    context: clip(plain(question.context), MAX_CONTEXT),
    stem: plain(question.stem),
    alternatives: question.alternatives.map((alternative) => ({
      letter: alternative.letter,
      text: clip(plain(alternative.text), MAX_ALTERNATIVE),
    })),
  };
}

function requestBody(questions) {
  return {
    systemInstruction: { parts: [{ text: systemInstruction() }] },
    contents: [
      {
        role: "user",
        parts: [{ text: JSON.stringify(questions.map(questionPayload)) }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING" },
            subject: { type: "STRING" },
            topic: { type: "STRING" },
          },
          required: ["id", "subject", "topic"],
        },
      },
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestGemini(questions, apiKey, model, attempt = 1) {
  try {
    const response = await fetch(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(requestBody(questions)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) return await response.json();

    const detail = (await response.text()).slice(0, 300);
    // 400/401/403 são chave ou contrato errado: repetir não resolve
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`HTTP ${response.status} na API: ${detail}`);
    }
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(`HTTP ${response.status} depois de ${attempt} tentativas: ${detail}`);
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    const wait = Math.min(retryAfter > 0 ? retryAfter * 1000 : 15_000 * attempt, 60_000);
    console.warn(`  · limite/erro ${response.status}, esperando ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return requestGemini(questions, apiKey, model, attempt + 1);
  } catch (err) {
    const name = err?.name;
    const retryable =
      name === "AbortError" ||
      name === "TimeoutError" ||
      /fetch failed|network|socket/i.test(err?.message ?? "");
    if (!retryable) throw err;
    if (attempt >= MAX_ATTEMPTS) throw err;
    await sleep(2_000 * attempt);
    return requestGemini(questions, apiKey, model, attempt + 1);
  }
}

function parseAnswers(data) {
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("resposta não é um array");
  return parsed;
}

/** Inglês/Espanhol não dependem do modelo: o idioma já define matéria e assunto */
function forcedSubject(question) {
  if (question.language === "ingles") {
    return { subject: "Inglês", topic: "Interpretação de Texto (Inglês)" };
  }
  if (question.language === "espanhol") {
    return { subject: "Espanhol", topic: "Interpretação de Texto (Espanhol)" };
  }
  return null;
}

/** valida a resposta contra a taxonomia: fora dela, a questão volta para as regras */
function isValidAnswer(question, answer) {
  // Inglês/Espanhol são definidos pelo idioma; a resposta do modelo não muda isso
  if (forcedSubject(question)) return true;

  if (!SUBJECT_AREA.has(answer.subject)) return false;
  if (answer.topic === "Geral") return true;
  return Object.hasOwn(TOPIC_RULES[answer.subject] ?? {}, answer.topic);
}

function applyAnswer(question, answer, tag) {
  const forced = forcedSubject(question);
  const subject = forced?.subject ?? answer.subject;

  // a API às vezes marca a área errada (ex.: questão de Física em Ciências
  // Humanas); se o modelo discordar com uma matéria válida, a área acompanha
  const area = SUBJECT_AREA.get(subject);
  const areaChanged = Boolean(area && area !== question.area);
  if (areaChanged) {
    question.area = area;
    question.areaLabel = AREA_LABEL[area];
  }

  question.subject = subject;
  question.topic = forced?.topic ?? answer.topic;
  question.classifiedBy = tag;
  return areaChanged;
}

function applyRules(question) {
  const result = classify({
    area: question.area,
    language: question.language,
    stem: plain(question.stem),
    context: plain(question.context),
    alternatives: question.alternatives.map((alternative) => plain(alternative.text)),
  });
  question.subject = result.subject;
  question.topic = result.topic;
  question.classifiedBy = RULES_VERSION;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** amostra determinística: pega itens espaçados, sem depender de sorte */
function pickEvenly(items, limit) {
  if (!limit || limit >= items.length) return items;
  const step = items.length / limit;
  return Array.from({ length: limit }, (_, index) => items[Math.floor(index * step)]);
}

async function loadData() {
  const read = async (name) => JSON.parse(await readFile(path.join(DATA_DIR, name), "utf8"));
  const [questions, catalog, meta] = await Promise.all([
    read("questions.json"),
    read("catalog.json"),
    read("meta.json"),
  ]);
  return { questions, catalog, meta };
}

/**
 * Grava a cada lote: se a execução cair no meio, o que já foi classificado
 * fica salvo e a próxima passa por cima só do que falta (o `classifiedBy`
 * funciona como marcador de retomada).
 */
async function persist({ questions, catalog, meta }) {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  for (const question of questions) {
    const entry = byId.get(question.id);
    if (!entry) continue;
    entry.area = question.area;
    entry.areaLabel = question.areaLabel;
    entry.subject = question.subject;
    entry.topic = question.topic;
  }

  const bySubject = {};
  for (const entry of catalog) bySubject[entry.subject] = (bySubject[entry.subject] ?? 0) + 1;
  meta.bySubject = bySubject;

  await Promise.all([
    writeFile(path.join(DATA_DIR, "questions.json"), JSON.stringify(questions)),
    writeFile(path.join(DATA_DIR, "catalog.json"), JSON.stringify(catalog)),
    writeFile(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2)),
  ]);
}

function printSample(questions, catalog, fallbacks) {
  const previews = new Map(catalog.map((entry) => [entry.id, entry.preview]));
  const fallbackIds = new Set(fallbacks.map((item) => item.id));
  console.log("\n--- amostra classificada ---");
  for (const question of questions) {
    const preview = (previews.get(question.id) ?? "").slice(0, 90);
    const marker = fallbackIds.has(question.id) ? "[REGRAS]" : "[modelo]";
    console.log(
      `${marker} ${question.id} | ${question.area} | ${question.subject} > ${question.topic} | ${preview}`,
    );
  }
  for (const fallback of fallbacks) {
    console.log(`  ! ${fallback.id}: ${fallback.reason}`);
  }
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function buildReport(questions, options, run) {
  const tag = `${options.model}/${PROMPT_VERSION}`;
  return {
    generatedAt: new Date().toISOString(),
    model: options.model,
    promptVersion: PROMPT_VERSION,
    lastRun: run,
    dataset: {
      total: questions.length,
      byClassifier: countBy(questions, (question) => question.classifiedBy ?? "sem-classificacao"),
      bySubject: countBy(questions, (question) => question.subject),
      /** questões que ainda não têm a etiqueta do modelo (voltaram para as regras) */
      fallbacks: questions
        .filter((question) => question.classifiedBy !== tag)
        .map((question) => question.id),
    },
  };
}

async function writeReport(questions, options, run) {
  await writeFile(
    path.join(DATA_DIR, "classify-report.json"),
    JSON.stringify(buildReport(questions, options, run), null, 2),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = await readApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não encontrada no ambiente nem em .env.local");
  }

  const data = await loadData();
  const tag = `${options.model}/${PROMPT_VERSION}`;
  const pending = data.questions.filter(
    (question) => options.force || question.classifiedBy !== tag,
  );
  const selected = pickEvenly(pending, options.limit);

  console.log(`modelo: ${options.model}`);
  console.log(`pendentes: ${pending.length} | nesta execução: ${selected.length}`);
  if (!selected.length) {
    // o relatório existente já descreve o acervo; sobrescrever com uma execução
    // vazia apagaria o consumo de tokens da última classificação de verdade
    console.log("nada a classificar — use --force para refazer");
    return;
  }

  // agrupa por área para o modelo manter o mesmo vocabulário no lote
  const ordered = [...selected].sort(
    (a, b) => a.area.localeCompare(b.area) || b.year - a.year || a.index - b.index,
  );
  const batches = chunk(ordered, BATCH_SIZE);
  const fallbacks = [];
  const usage = { prompt: 0, output: 0 };
  let classified = 0;
  let changed = 0;
  let areaChanged = 0;

  for (const [index, batch] of batches.entries()) {
    const before = new Map(
      batch.map((question) => [
        question.id,
        `${question.area}|${question.subject}|${question.topic}`,
      ]),
    );

    // erro de API (chave, cota, contrato) para a execução; resposta ilegível
    // não: as regras cobrem o lote e o `classifiedBy` deixa a questão pendente
    const response = await requestGemini(batch, apiKey, options.model);
    usage.prompt += response.usageMetadata?.promptTokenCount ?? 0;
    usage.output += response.usageMetadata?.candidatesTokenCount ?? 0;

    let answers = [];
    try {
      answers = parseAnswers(response);
    } catch (err) {
      console.warn(`  ! lote ${index + 1}: ${err.message} — caindo nas regras`);
    }

    const answered = new Map();
    for (const answer of answers) {
      if (typeof answer?.id === "string") answered.set(answer.id, answer);
    }

    for (const question of batch) {
      const answer = answered.get(question.id);
      if (answer && isValidAnswer(question, answer)) {
        if (applyAnswer(question, answer, tag)) areaChanged++;
        classified++;
      } else {
        applyRules(question);
        fallbacks.push({
          id: question.id,
          reason: answer
            ? `fora-da-taxonomia: ${answer.subject} > ${answer.topic}`
            : "sem-resposta",
        });
      }
      if (
        before.get(question.id) !==
        `${question.area}|${question.subject}|${question.topic}`
      ) {
        changed++;
      }
    }

    if (!options.dry) await persist(data);
    console.log(
      `lote ${index + 1}/${batches.length}: ${batch.length} questões ` +
        `(${classified} pelo modelo, ${fallbacks.length} nas regras)`,
    );
    await sleep(800);
  }

  const reportRun = {
    requested: selected.length,
    classified,
    changed,
    areaChanged,
    fallbacks,
    usage,
  };

  if (options.dry) {
    printSample(selected, data.catalog, fallbacks);
  } else {
    await writeReport(data.questions, options, reportRun);
  }

  console.log("\n--- resumo ---");
  console.log(`modelo: ${options.model} (${PROMPT_VERSION})`);
  console.log(`classificadas pelo modelo: ${classified}`);
  console.log(`nas regras (rever depois): ${fallbacks.length}`);
  console.log(`mudaram de matéria/assunto: ${changed}`);
  console.log(`tiveram a área corrigida: ${areaChanged}`);
  if (options.dry) console.log("modo --dry: nenhum arquivo foi gravado");
}

await main();
