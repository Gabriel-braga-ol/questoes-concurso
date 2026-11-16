import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/site";

const nextConfig: NextConfig = {
  /**
   * Site 100% estático: sem servidor, sem banco, deploy em qualquer host
   * de arquivos estáticos. Quando o acervo justificar um banco, basta
   * remover esta linha e mover a leitura de dados para uma API.
   */
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },

  /**
   * Project page do GitHub Pages: o site vive em /questoes-concurso/, não na
   * raiz do domínio. O build de produção já sai com esse prefixo (o dev usa a
   * raiz), então links e arquivos de `_next` apontam para o lugar certo.
   */
  basePath: BASE_PATH,

  /**
   * Este projeto usa Tailwind v4 pelo loader do Turbopack (não por
   * PostCSS). Sem esta regra o `@theme` do globals.css não é processado
   * e nenhuma classe é gerada.
   */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
