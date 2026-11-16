import type { HistoryStats } from "@/lib/history";

/**
 * Faixa de progresso da home. É só apresentação: o estado e o cálculo ficam no
 * hook `useAnswerHistory` e em `src/lib/history.ts`.
 */
export function HistoryProgress({
  stats,
  total,
  ready,
}: {
  stats: HistoryStats;
  total: number;
  ready: boolean;
}) {
  if (!ready) {
    // mesmo espaço da faixa pronta, para a lista não pular depois da hidratação
    return (
      <section
        aria-hidden="true"
        className="mb-8 rounded-2xl border border-line bg-white/60 px-4 py-4 sm:px-5"
      >
        <div className="h-[19px] w-2/3 max-w-xs rounded bg-stone-100" />
        <div className="mt-3 h-1.5 rounded-full bg-stone-100" />
      </section>
    );
  }

  const percent = total ? Math.round((stats.answered / total) * 100) : 0;
  const streak =
    stats.streak > 0
      ? `${stats.streak} ${stats.streak === 1 ? "dia seguido" : "dias seguidos"}`
      : "sem sequência";

  return (
    <section className="mb-8 rounded-2xl border border-line bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
        <span className="font-medium text-ink">
          {stats.answered} de {total} respondidas
        </span>
        <span className="text-stone-300">·</span>
        <span>{stats.correctRate}% de acerto</span>
        <span className="text-stone-300">·</span>
        <span>{streak}</span>
        <span className="ml-auto text-[11px] text-muted">salvo neste navegador</span>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-label="Questões respondidas"
        aria-valuenow={stats.answered}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}
