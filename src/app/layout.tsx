import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MyVest — questões de vestibular para resolver rabiscando",
    template: "%s · MyVest",
  },
  description:
    "Questões de vestibular e concurso organizadas por matéria e assunto, com uma prancheta para resolver rabiscando em cima do enunciado.",
  keywords: [
    "questões de vestibular",
    "questões do ENEM",
    "resolver questões",
    "estudar para o vestibular",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-paper transition-transform group-hover:-rotate-6">
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
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                MyVest
              </span>
            </Link>

            <nav className="flex items-center gap-1 text-sm text-muted">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 transition-colors hover:bg-white hover:text-ink"
              >
                Questões
              </Link>
              <Link
                href="/sobre"
                className="rounded-md px-3 py-1.5 transition-colors hover:bg-white hover:text-ink"
              >
                Sobre
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex flex-1 flex-col">{children}</div>

        <footer className="mt-16 border-t border-line bg-white/60">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Projeto gratuito e sem fins comerciais. Questões do ENEM de fonte
              pública (INEP), via{" "}
              <a
                href="https://enem.dev"
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-ink"
              >
                enem.dev
              </a>
              .
            </p>
            <p>
              Matéria e assunto são classificados automaticamente e podem
              conter erros.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
