"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UNCLASSIFIED,
  catalog,
  meta,
  searchEntries,
  subjectCounts,
  topicCounts,
  topicLabel,
} from "@/lib/catalog";
import {
  filterByHistory,
  historyCounts,
  historyStats,
  sortByRecentReview,
  type HistoryScope,
} from "@/lib/history";
import { useAnswerHistory } from "@/hooks/useAnswerHistory";
import type { CatalogEntry } from "@/lib/types";
import { HistoryProgress } from "./HistoryProgress";

const PAGE = 40;

const SOON_EXAMS = ["FUVEST", "UNICAMP", "CEDERJ", "Concursos"];

type Filters = {
  subject: string | null;
  topic: string | null;
  query: string;
  scope: HistoryScope;
};

function isHistoryScope(value: string | null): value is Exclude<HistoryScope, "all"> {
  return value === "wrong" || value === "unanswered";
}

function readFiltersFromUrl(): Filters {
  if (typeof window === "undefined") {
    return { subject: null, topic: null, query: "", scope: "all" };
  }
  const params = new URLSearchParams(window.location.search);
  const scope = params.get("f");
  return {
    subject: params.get("m"),
    topic: params.get("a"),
    query: params.get("q") ?? "",
    scope: isHistoryScope(scope) ? scope : "all",
  };
}

function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.subject) params.set("m", filters.subject);
  if (filters.topic) params.set("a", filters.topic);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.scope !== "all") params.set("f", filters.scope);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function QuestionExplorer() {
  const router = useRouter();
  const [subject, setSubject] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<HistoryScope>("all");
  const [visible, setVisible] = useState(PAGE);
  const { history, ready } = useAnswerHistory();
  const searchRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  // estado inicial vem da URL (links de "voltar" a partir de uma questão)
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const initial = readFiltersFromUrl();
    setSubject(initial.subject);
    setTopic(initial.topic);
    setQuery(initial.query);
    setScope(initial.scope);
  }, []);
  // mantém a URL sincronizada sem navegar (não queremos remontar a página)
  useEffect(() => {
    if (!hydrated.current) return;
    const search = filtersToSearch({ subject, topic, query, scope });
    window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }, [subject, topic, query, scope]);

  // atalho "/" para buscar, como em site de documentação
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const subjects = useMemo(() => subjectCounts(catalog), []);
  const topics = useMemo(
    () => (subject ? topicCounts(catalog, subject) : []),
    [subject],
  );

  const baseResults = useMemo(() => {
    let scoped: CatalogEntry[] = catalog;
    if (subject) scoped = scoped.filter((entry) => entry.subject === subject);
    if (topic) scoped = scoped.filter((entry) => entry.topic === topic);
    return searchEntries(scoped, query);
  }, [subject, topic, query]);

  const results = useMemo(() => {
    // antes de ler o localStorage não dá para separar respondidas de pendentes;
    // mostrar a lista inteira por um instante é melhor que mostrar a errada
    if (!ready || scope === "all") return baseResults;
    const filtered = filterByHistory(baseResults, history, scope);
    return scope === "wrong" ? sortByRecentReview(filtered, history) : filtered;
  }, [baseResults, history, ready, scope]);

  const counts = useMemo(
    () => historyCounts(baseResults, history),
    [baseResults, history],
  );
  const stats = useMemo(() => historyStats(history), [history]);

  const chooseSubject = useCallback((name: string) => {
    setSubject((current) => (current === name ? null : name));
    // trocar de matéria invalida o assunto selecionado e reinicia a lista
    setTopic(null);
    setVisible(PAGE);
  }, []);

  const chooseTopic = useCallback((name: string) => {
    setTopic((current) => (current === name ? null : name));
    setVisible(PAGE);
  }, []);

  const chooseScope = useCallback((next: HistoryScope) => {
    setScope((current) => (current === next ? "all" : next));
    setVisible(PAGE);
  }, []);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setVisible(PAGE);
  }, []);

  const randomQuestion = useCallback(() => {
    if (!results.length) return;
    const pick = results[Math.floor(Math.random() * results.length)];
    router.push(`/questao/${pick.id}/`);
  }, [results, router]);

  const shown = results.slice(0, visible);
  const heading =
    scope === "wrong"
      ? "Errei"
      : scope === "unanswered"
        ? "Não respondidas"
        : topic
          ? topicLabel(topic)
          : subject
            ? subject
            : "Todas as questões";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <section className="pt-12 pb-9 sm:pt-16">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium tracking-wide text-muted uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {meta.total} questões · ENEM {meta.years[0]}–{meta.years.at(-1)}
        </p>
        <h1 className="max-w-2xl text-[2rem] leading-[1.15] font-semibold tracking-tight sm:text-[2.6rem]">
          Escolha a questão.
          <br />
          <span className="text-muted">Resolva rabiscando.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Sem menu atrás de menu. Filtre por matéria e assunto, abra a questão e
          use a prancheta para fazer conta no próprio enunciado.
        </p>
      </section>

      <HistoryProgress stats={stats} total={meta.total} ready={ready} />

      <section className="mb-8">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Buscar por assunto, ano ou trecho do enunciado…"
            aria-label="Buscar questões"
            className="h-12 w-full rounded-xl border border-line bg-white pr-12 pl-11 text-[15px] shadow-[0_1px_2px_rgba(28,25,23,0.04)] outline-none transition placeholder:text-stone-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line bg-paper px-1.5 py-0.5 text-[11px] font-medium text-muted sm:block">
            /
          </kbd>
        </div>
      </section>

      <section className="space-y-4 border-y border-line py-5">
        <FilterRow label="Vestibular">
          <Chip active label="ENEM" count={meta.total} onClick={() => {}} />
          {SOON_EXAMS.map((name) => (
            <Chip key={name} label={name} soon />
          ))}
        </FilterRow>

        <FilterRow label="Matéria">
          {subjects.map(({ name, count }) => (
            <Chip
              key={name}
              label={name}
              count={count}
              active={subject === name}
              onClick={() => chooseSubject(name)}
            />
          ))}
        </FilterRow>

        {subject ? (
          <FilterRow label="Assunto">
            {topics.map(({ name, count }) => (
              <Chip
                key={name}
                label={topicLabel(name)}
                count={count}
                active={topic === name}
                muted={name === UNCLASSIFIED}
                onClick={() => chooseTopic(name)}
              />
            ))}
          </FilterRow>
        ) : (
          <FilterRow label="Assunto">
            <p className="text-[13px] text-muted">
              Escolha uma matéria para ver os assuntos.
            </p>
          </FilterRow>
        )}

        {ready ? (
          <FilterRow label="Progresso">
            <Chip
              label="Todas"
              active={scope === "all"}
              onClick={() => chooseScope("all")}
            />
            <Chip
              label="Errei"
              count={counts.wrong}
              active={scope === "wrong"}
              title="Inclui questões em que você revelou o gabarito"
              onClick={() => chooseScope("wrong")}
            />
            <Chip
              label="Não respondidas"
              count={counts.unanswered}
              active={scope === "unanswered"}
              onClick={() => chooseScope("unanswered")}
            />
          </FilterRow>
        ) : null}
      </section>

      <section className="pt-6 pb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            {heading}
            <span className="ml-2 font-normal text-muted">
              {results.length} {results.length === 1 ? "questão" : "questões"}
            </span>
          </h2>
          <button
            type="button"
            onClick={randomQuestion}
            disabled={!results.length}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-medium transition hover:border-brand/30 hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
            </svg>
            Questão aleatória
          </button>
        </div>

        {results.length === 0 ? (
          <EmptyState
            query={query}
            scope={scope}
            onClear={() => {
              setQuery("");
              setTopic(null);
              setScope("all");
              setVisible(PAGE);
            }}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {shown.map((entry) => (
              <QuestionRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}

        {visible < results.length ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className="rounded-lg border border-line bg-white px-4 py-2 text-[13px] font-medium transition hover:border-brand/30 hover:text-brand-dark"
            >
              Mostrar mais {Math.min(PAGE, results.length - visible)} questões
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <span className="w-20 shrink-0 pt-1.5 text-[11px] font-medium tracking-wider text-muted uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  label,
  count,
  active = false,
  soon = false,
  muted = false,
  title,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  soon?: boolean;
  muted?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition-colors";

  if (soon) {
    return (
      <span
        title="Ainda não disponível"
        className={`${base} cursor-not-allowed border-dashed border-line text-stone-400`}
      >
        {label}
        <span className="text-[10px] tracking-wide uppercase">em breve</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`${base} ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-white hover:border-stone-300"
      } ${muted && !active ? "text-muted" : ""}`}
    >
      {label}
      {typeof count === "number" ? (
        <span
          className={`text-[11px] tabular-nums ${
            active ? "text-white/60" : "text-stone-400"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function QuestionRow({ entry }: { entry: CatalogEntry }) {
  return (
    <li>
      <Link
        href={`/questao/${entry.id}/`}
        className="group flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-paper sm:px-5"
      >
        <span className="mt-0.5 w-9 shrink-0 text-right font-mono text-[11px] text-stone-400 tabular-nums">
          {entry.index}
        </span>

        <span className="min-w-0 flex-1">
          <span className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
            <span className="font-medium text-ink">ENEM {entry.year}</span>
            <span className="text-stone-300">·</span>
            <span>{entry.subject}</span>
            {entry.topic !== UNCLASSIFIED ? (
              <>
                <span className="text-stone-300">·</span>
                <span className="text-stone-500">{entry.topic}</span>
              </>
            ) : null}
          </span>
          <span className="line-clamp-2 block text-[13.5px] leading-relaxed text-stone-600">
            {entry.preview || "Questão sem texto de apoio."}
          </span>
        </span>

        <svg
          viewBox="0 0 24 24"
          className="mt-1 h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </li>
  );
}

function EmptyState({
  query,
  scope,
  onClear,
}: {
  query: string;
  scope: HistoryScope;
  onClear: () => void;
}) {
  const title =
    scope === "wrong"
      ? "Nada para revisar"
      : scope === "unanswered"
        ? "Tudo respondido"
        : "Nenhuma questão encontrada";
  const message =
    scope === "wrong"
      ? "Nenhum erro neste filtro. As questões que você errar aparecem aqui."
      : scope === "unanswered"
        ? "Todas as questões deste filtro já foram respondidas."
        : query
          ? `Nada para “${query}” neste filtro. Tente outra palavra ou limpe o filtro.`
          : "Tente outra combinação de matéria e assunto.";

  return (
    <div className="rounded-xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{message}</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-medium transition hover:border-brand/30 hover:text-brand-dark"
      >
        {scope === "all" ? "Limpar busca" : "Limpar filtro"}
      </button>
    </div>
  );
}
