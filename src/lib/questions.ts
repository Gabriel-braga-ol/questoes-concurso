import { readFileSync } from "node:fs";
import path from "node:path";
import type { Question } from "./types";

/**
 * Lido com `fs` em vez de `import` de propósito: questions.json tem alguns
 * MB e só é usado no build (server component). Importar o JSON faria o
 * bundler carregá-lo no grafo do cliente sem necessidade.
 *
 * Este módulo só pode ser importado por Server Components.
 */
let cache: Map<string, Question> | null = null;

function load(): Map<string, Question> {
  if (cache) return cache;
  const file = path.join(process.cwd(), "src", "data", "questions.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as Question[];
  cache = new Map(raw.map((question) => [question.id, question]));
  return cache;
}

export function getQuestion(id: string): Question | undefined {
  return load().get(id);
}

export function getQuestionIds(): string[] {
  return [...load().keys()];
}

export function getQuestions(ids: string[]): Question[] {
  const map = load();
  return ids.map((id) => map.get(id)).filter((q): q is Question => Boolean(q));
}
