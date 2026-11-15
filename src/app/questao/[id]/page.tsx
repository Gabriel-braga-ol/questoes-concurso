import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionView } from "@/components/QuestionView";
import { catalog, UNCLASSIFIED } from "@/lib/catalog";
import { getQuestion, getQuestionIds } from "@/lib/questions";

/**
 * Site estático: todas as páginas de questão são geradas no build.
 * `dynamicParams = false` faz um id inexistente virar 404 em vez de
 * tentar renderizar no servidor (que aqui não existe).
 */
export const dynamicParams = false;

type Neighbor = { id: string; index: number; topic: string };

export function generateStaticParams() {
  return getQuestionIds().map((id) => ({ id }));
}

export async function generateMetadata(
  props: PageProps<"/questao/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const question = getQuestion(id);
  if (!question) return { title: "Questão não encontrada" };

  return {
    title: `Questão ${question.index} · ${question.subject} · ENEM ${question.year}`,
    description: question.stem.slice(0, 160) || question.context.slice(0, 160),
  };
}

/** questões vizinhas dentro do mesmo assunto (ou da mesma matéria) */
function findNeighbors(id: string): { previous: Neighbor | null; next: Neighbor | null } {
  const current = catalog.find((entry) => entry.id === id);
  if (!current) return { previous: null, next: null };

  const scoped = catalog.filter(
    (entry) =>
      entry.subject === current.subject &&
      (current.topic === UNCLASSIFIED || entry.topic === current.topic),
  );

  const position = scoped.findIndex((entry) => entry.id === id);
  if (position === -1) return { previous: null, next: null };

  const toNeighbor = (entry?: (typeof scoped)[number]): Neighbor | null =>
    entry ? { id: entry.id, index: entry.index, topic: entry.topic } : null;

  return {
    previous: toNeighbor(scoped[position - 1]),
    next: toNeighbor(scoped[position + 1]),
  };
}

export default async function QuestionPage(props: PageProps<"/questao/[id]">) {
  const { id } = await props.params;
  const question = getQuestion(id);
  if (!question) notFound();

  const { previous, next } = findNeighbors(id);

  return (
    <QuestionView question={question} previous={previous} next={next} />
  );
}
