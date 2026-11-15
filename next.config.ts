import type { NextConfig } from "next";

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
