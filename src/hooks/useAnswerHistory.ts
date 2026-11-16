"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getHistorySnapshot,
  getServerHistorySnapshot,
  recordAttempt,
  subscribeHistory,
  writeHistory,
  type AnswerAttempt,
} from "@/lib/history";

/**
 * Estado do histórico no cliente. Lido do `localStorage` via
 * `useSyncExternalStore`: o servidor devolve um snapshot vazio e a hidratação
 * não vê "0 respondidas" antes de conhecer o número real.
 */
export function useAnswerHistory() {
  const { history, ready } = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getServerHistorySnapshot,
  );

  const record = useCallback((questionId: string, attempt: AnswerAttempt) => {
    writeHistory(recordAttempt(getHistorySnapshot().history, questionId, attempt));
  }, []);

  return { history, ready, record };
}
