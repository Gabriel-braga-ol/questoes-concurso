import type { CatalogEntry } from "./types";

/**
 * Histórico de respostas guardado no `localStorage`.
 *
 * O registro é por questão e acumula tentativas: responder de novo não apaga
 * a anterior. `outcome` distingue erro de "revelou o gabarito" — nos dois a
 * questão entra na revisão, mas só o erro conta como resposta errada.
 *
 * Nada aqui sai do navegador. Limpar os dados do site ou trocar de aparelho
 * perde o histórico, a mesma regra do desenho.
 */

export type AnswerOutcome = "correct" | "wrong" | "revealed";

export type AnswerAttempt = {
  /** alternativa marcada; `null` quando o usuário só revelou o gabarito */
  letter: string | null;
  outcome: AnswerOutcome;
  /** ISO 8601 no fuso local do navegador */
  at: string;
};

export type HistoryRecord = {
  attempts: AnswerAttempt[];
};

export type History = Record<string, HistoryRecord>;

export type HistoryStats = {
  answered: number;
  correct: number;
  wrong: number;
  revealed: number;
  /** acertos sobre o total respondido, na última tentativa de cada questão */
  correctRate: number;
  /** dias consecutivos com pelo menos uma resposta, contando hoje ou ontem */
  streak: number;
};

export const HISTORY_STORAGE_KEY = "myvest:history:v1";
export const HISTORY_CHANGED_EVENT = "myvest:history-changed";

/**
 * `useSyncExternalStore` exige um snapshot estável: devolver um objeto novo a
 * cada leitura faria o React achar que o estado mudou para sempre. O cache é
 * invalidado quando outra aba grava, e substituído na gravação local.
 */
export type HistorySnapshot = {
  history: History;
  /** falso no servidor/hidratação: ainda não dá para saber o que há no navegador */
  ready: boolean;
};

const SERVER_SNAPSHOT: HistorySnapshot = { history: {}, ready: false };
let snapshot: HistorySnapshot | null = null;

const OUTCOMES = new Set<AnswerOutcome>(["correct", "wrong", "revealed"]);

function isAttempt(value: unknown): value is AnswerAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Record<string, unknown>;
  const letter = attempt.letter;
  return (
    OUTCOMES.has(attempt.outcome as AnswerOutcome) &&
    (letter === null || typeof letter === "string") &&
    typeof attempt.at === "string" &&
    !Number.isNaN(Date.parse(attempt.at))
  );
}

/** lê o que veio do localStorage sem confiar no formato: dado antigo é descartado */
function parseHistory(raw: string | null): History {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const history: History = {};
  for (const [questionId, value] of Object.entries(parsed as Record<string, unknown>)) {
    const attempts = (value as { attempts?: unknown })?.attempts;
    if (!Array.isArray(attempts)) continue;
    const valid = attempts.filter(isAttempt);
    if (valid.length) history[questionId] = { attempts: valid };
  }
  return history;
}

export function readHistory(): History {
  if (typeof window === "undefined") return {};
  try {
    return parseHistory(window.localStorage.getItem(HISTORY_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function getHistorySnapshot(): HistorySnapshot {
  if (!snapshot) snapshot = { history: readHistory(), ready: true };
  return snapshot;
}

export function getServerHistorySnapshot(): HistorySnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeHistory(onChange: () => void): () => void {
  // ao montar, relê o localStorage: outra aba pode ter gravado enquanto este
  // componente estava fora da árvore e não havia listener para avisar
  snapshot = null;

  function handleLocalChange() {
    // a gravação local já deixou o snapshot atualizado
    onChange();
  }

  function handleStorage(event: StorageEvent) {
    if (event.key && event.key !== HISTORY_STORAGE_KEY) return;
    snapshot = null;
    onChange();
  }

  window.addEventListener(HISTORY_CHANGED_EVENT, handleLocalChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(HISTORY_CHANGED_EVENT, handleLocalChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function writeHistory(history: History): void {
  if (typeof window === "undefined") return;
  snapshot = { history, ready: true };
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // cota cheia ou modo privado: a resposta vale para esta sessão
  }
  // a mesma aba não recebe o evento `storage`; este avisa os hooks montados
  window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT));
}

export function recordAttempt(
  history: History,
  questionId: string,
  attempt: AnswerAttempt,
): History {
  const attempts = history[questionId]?.attempts ?? [];
  return { ...history, [questionId]: { attempts: [...attempts, attempt] } };
}

export function lastAttempt(record: HistoryRecord | undefined): AnswerAttempt | null {
  return record?.attempts.at(-1) ?? null;
}

/** questão já respondida e cuja última tentativa não foi um acerto */
export function needsReview(record: HistoryRecord | undefined): boolean {
  return Boolean(record?.attempts.length) && lastAttempt(record)?.outcome !== "correct";
}

export function isUnanswered(record: HistoryRecord | undefined): boolean {
  return !record?.attempts.length;
}

export function lastAttemptTime(record: HistoryRecord | undefined): number {
  const attempt = lastAttempt(record);
  return attempt ? Date.parse(attempt.at) : 0;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Sequência de dias com resposta. Se hoje ainda não houve resposta, a
 * sequência de ontem continua valendo: ela só zera depois de um dia inteiro
 * sem estudar.
 */
export function currentStreak(timestamps: string[], now = new Date()): number {
  const days = new Set<string>();
  for (const timestamp of timestamps) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) days.add(dayKey(date));
  }
  if (!days.size) return 0;

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function historyStats(history: History, now = new Date()): HistoryStats {
  let correct = 0;
  let wrong = 0;
  let revealed = 0;
  const timestamps: string[] = [];

  for (const record of Object.values(history)) {
    for (const attempt of record.attempts) timestamps.push(attempt.at);

    const latest = lastAttempt(record);
    if (latest?.outcome === "correct") correct++;
    else if (latest?.outcome === "wrong") wrong++;
    else if (latest?.outcome === "revealed") revealed++;
  }

  const answered = correct + wrong + revealed;
  return {
    answered,
    correct,
    wrong,
    revealed,
    correctRate: answered ? Math.round((correct / answered) * 100) : 0,
    streak: currentStreak(timestamps, now),
  };
}

/** "12/11" — a data da tentativa no fuso do navegador */
export function formatAttemptDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export type HistoryScope = "all" | "wrong" | "unanswered";

export function filterByHistory(
  entries: CatalogEntry[],
  history: History,
  scope: HistoryScope,
): CatalogEntry[] {
  if (scope === "unanswered") {
    return entries.filter((entry) => isUnanswered(history[entry.id]));
  }
  if (scope === "wrong") {
    return entries.filter((entry) => needsReview(history[entry.id]));
  }
  return entries;
}

/** revisão: o erro mais recente primeiro */
export function sortByRecentReview(
  entries: CatalogEntry[],
  history: History,
): CatalogEntry[] {
  return [...entries].sort(
    (a, b) => lastAttemptTime(history[b.id]) - lastAttemptTime(history[a.id]),
  );
}

export function historyCounts(
  entries: CatalogEntry[],
  history: History,
): { wrong: number; unanswered: number } {
  let wrong = 0;
  let unanswered = 0;
  for (const entry of entries) {
    const record = history[entry.id];
    if (isUnanswered(record)) unanswered++;
    else if (needsReview(record)) wrong++;
  }
  return { wrong, unanswered };
}
