import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre",
  description:
    "O que é o MyVest, de onde vêm as questões e o que significam os assuntos classificados automaticamente.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-12 pb-4 sm:px-6 sm:pt-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition hover:text-ink"
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
          <path d="m15 18-6-6 6-6" />
        </svg>
        Voltar para as questões
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Sobre o MyVest</h1>

      <div className="question-text mt-6">
        <p>
          O MyVest é um projeto <strong>gratuito e sem fins comerciais</strong>{" "}
          para resolver questões de vestibular sem navegar por uma pilha de
          menus. Você filtra por matéria e assunto, abre a questão e pode
          rabiscar direto em cima do enunciado.
        </p>

        <h2 className="mt-8 mb-2 text-lg font-semibold text-ink">
          De onde vêm as questões
        </h2>
        <p>
          Hoje o acervo cobre o <strong>ENEM de 2019 a 2023</strong>, obtido da
          API pública{" "}
          <a href="https://enem.dev" target="_blank" rel="noreferrer noopener">
            enem.dev
          </a>
          , que organiza os dados oficiais do INEP. As imagens são copiadas para
          o próprio site, para não depender de link externo.
        </p>
        <p>
          Cada questão mantém o ano e o número original. Se você encontrar algo
          errado, o enunciado oficial é a referência.
        </p>

        <h2 className="mt-8 mb-2 text-lg font-semibold text-ink">
          Por que o assunto pode estar errado
        </h2>
        <p>
          A fonte não informa o assunto: ela informa apenas a grande área
          (Matemática, Ciências da Natureza, etc.). A divisão em{" "}
          <em>Probabilidade</em>, <em>Funções</em>, <em>Termologia</em> é feita
          por um classificador de palavras-chave, porque o vocabulário dessas
          questões é razoavelmente previsível.
        </p>
        <p>
          Ele é útil, não é infalível. Questões multidisciplinares e de
          interpretação costumam cair em <strong>Outros temas</strong>, que é
          onde ficam os casos em que o classificador preferiu não arriscar.
        </p>

        <h2 className="mt-8 mb-2 text-lg font-semibold text-ink">
          Sobre o desenho
        </h2>
        <p>
          A prancheta usa o{" "}
          <a
            href="https://excalidraw.com"
            target="_blank"
            rel="noreferrer noopener"
          >
            Excalidraw
          </a>
          , com lápis, formas geométricas, borracha e exportação em PNG. O
          desenho fica salvo no seu navegador, associado à questão — nada é
          enviado para servidor nenhum.
        </p>

        <h2 className="mt-8 mb-2 text-lg font-semibold text-ink">Contato</h2>
        <p>
          Este projeto está em desenvolvimento. Sugestões, correções de gabarito
          ou pedidos de remoção de conteúdo são bem-vindos pelo e-mail{" "}
          <a href="mailto:contato@myvest.app">contato@myvest.app</a>.
        </p>
      </div>
    </main>
  );
}
