"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { UNCLASSIFIED } from "@/lib/catalog";
import type { Question } from "@/lib/types";
import { DrawingBoard } from "./DrawingBoard";

type Neighbor = { id: string; index: number; topic: string } | null;

export function QuestionView({
  question,
  previous,
  next,
}: {
  question: Question;
  previous: Neighbor;
  next: Neighbor;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const answered = selected !== null || revealed;
  const isCorrect = selected !== null && selected === question.correct;

  function choose(letter: string) {
    if (selected) return; // uma tentativa por vez; use "tentar de novo"
    setSelected(letter);
  }

  function reset() {
    setSelected(null);
    setRevealed(false);
  }

  return (
    <>
      {/*
        Com a prancheta aberta a partir de `lg` o texto cede a metade direita
        para o painel de desenho. Abaixo disso o painel é sobreposto, então nada
        muda.
      */}
      <main
        className={`mx-auto w-full max-w-3xl px-4 pt-8 pb-28 sm:px-6 sm:pt-10 ${
          drawing ? "lg:mr-[50%] lg:ml-0 lg:w-1/2" : ""
        }`}
      >        <nav
          aria-label="Trilha"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-[12px] text-muted"
        >
          <Link href="/" className="transition hover:text-ink">
            ENEM
          </Link>
          <span className="text-stone-300">/</span>
          <Link
            href={`/?m=${encodeURIComponent(question.subject)}`}
            className="transition hover:text-ink"
          >
            {question.subject}
          </Link>
          {question.topic !== UNCLASSIFIED ? (
            <>
              <span className="text-stone-300">/</span>
              <Link
                href={`/?m=${encodeURIComponent(question.subject)}&a=${encodeURIComponent(question.topic)}`}
                className="transition hover:text-ink"
              >
                {question.topic}
              </Link>
            </>
          ) : null}
        </nav>

        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
              Questão {question.index}
              {question.language ? ` · ${question.language}` : ""}
            </p>
            <h1 className="mt-1.5 text-[22px] leading-snug font-semibold tracking-tight">
              {question.topic === UNCLASSIFIED ? question.subject : question.topic}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              ENEM {question.year} · {question.areaLabel}
            </p>
          </div>
        </header>

        <article className="question-text rounded-2xl border border-line bg-white px-5 py-6 shadow-[0_1px_3px_rgba(28,25,23,0.04)] sm:px-8 sm:py-8">
          {question.context ? <Markdown>{question.context}</Markdown> : null}

          {question.images.length ? (
            <div className="mt-4 space-y-3">
              {question.images
                .filter(
                  // a API repete em `files` imagens que já estão no markdown
                  (src) => !question.context.includes(src) && !question.stem.includes(src),
                )
                .map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt="Imagem da questão"
                    className="max-w-full rounded-lg border border-line"
                    loading="lazy"
                  />
                ))}
            </div>
          ) : null}

          {question.stem ? (
            <div className="mt-5">
              <Markdown>{question.stem}</Markdown>
            </div>
          ) : null}

          <ul className="mt-6 space-y-2">
            {question.alternatives.map((alternative) => {
              const isRight = answered && alternative.letter === question.correct;
              const isWrongPick =
                selected === alternative.letter &&
                alternative.letter !== question.correct;

              return (
                <li key={alternative.letter}>
                  <button
                    type="button"
                    onClick={() => choose(alternative.letter)}
                    disabled={answered}
                    className={[
                      "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                      isRight
                        ? "border-emerald-300 bg-emerald-50"
                        : isWrongPick
                          ? "border-red-300 bg-red-50"
                          : answered
                            ? "border-line bg-white opacity-60"
                            : "border-line bg-white hover:border-stone-300 hover:bg-paper",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                        isRight
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : isWrongPick
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-line text-stone-500",
                      ].join(" ")}
                    >
                      {alternative.letter}
                    </span>

                    <span className="min-w-0 flex-1">
                      {alternative.text ? (
                        <span className="block text-[14px] leading-relaxed text-stone-700">
                          {alternative.text}
                        </span>
                      ) : null}
                      {alternative.image ? (
                        <img
                          src={alternative.image}
                          alt={`Alternativa ${alternative.letter}`}
                          className="mt-1 max-h-40 max-w-full rounded border border-line"
                          loading="lazy"
                        />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>

        <section className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px]">
            {!answered ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="text-muted underline underline-offset-2 transition hover:text-ink"
              >
                Ver gabarito
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`font-medium ${isCorrect ? "text-emerald-700" : "text-red-600"}`}
                >
                  {isCorrect
                    ? "Correto!"
                    : selected
                      ? "Não foi essa."
                      : "Gabarito"}
                </span>
                <span className="text-muted">
                  Resposta: <strong className="text-ink">{question.correct}</strong>
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="text-muted underline underline-offset-2 transition hover:text-ink"
                >
                  Tentar de novo
                </button>
              </div>
            )}
          </div>

          <a
            href={question.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[12px] text-muted underline-offset-2 transition hover:text-ink hover:underline"
          >
            Ver no enem.dev ↗
          </a>
        </section>

        <nav className="mt-8 flex items-stretch gap-2 border-t border-line pt-5">
          <NeighborLink direction="prev" neighbor={previous} />
          <NeighborLink direction="next" neighbor={next} />
        </nav>
      </main>

      {/* botão flutuante: a ação principal desta página */}
      <div
        data-floating-action
        className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4"
      >
        <button
          type="button"
          onClick={() => setDrawing(true)}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-white shadow-lg shadow-ink/20 transition hover:-translate-y-0.5 hover:bg-stone-800"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          </svg>
          Rabiscar na questão
        </button>
      </div>

      {drawing ? (
        <DrawingBoard
          key={question.id}
          storageKey={`myvest:drawing:v1:${question.id}`}
          onExit={() => setDrawing(false)}
        />
      ) : null}
    </>
  );
}

function NeighborLink({
  direction,
  neighbor,
}: {
  direction: "prev" | "next";
  neighbor: Neighbor;
}) {
  const isPrev = direction === "prev";
  const base =
    "flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-3 text-left transition";

  if (!neighbor) {
    return (
      <div className={`${base} cursor-not-allowed opacity-40`}>
        <span className="text-[12px] text-muted">
          {isPrev ? "Questão anterior" : "Próxima questão"}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/questao/${neighbor.id}/`}
      className={`${base} hover:border-brand/30 hover:bg-white ${
        isPrev ? "" : "flex-row-reverse text-right"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 shrink-0 text-stone-400 ${isPrev ? "" : "rotate-180"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span className="min-w-0">
        <span className="block text-[11px] text-muted">
          {isPrev ? "Anterior" : "Próxima"}
        </span>
        <span className="block truncate text-[13px] font-medium">
          Questão {neighbor.index}
        </span>
      </span>
    </Link>
  );
}

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children: content }) => (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {content}
          </a>
        ),
        img: ({ src, alt }) => (
          <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" />
        ),
        table: ({ children: content }) => (
          <div className="scroll-thin overflow-x-auto">
            <table>{content}</table>
          </div>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
