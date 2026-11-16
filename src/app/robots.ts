import type { MetadataRoute } from "next";
import { BASE_PATH, SITE_URL } from "@/lib/site";

/** rotas de metadados são Route Handlers; no export estático precisam ser fixas */
export const dynamic = "force-static";

/**
 * O robots.txt só é obedecido na raiz do domínio. Numa project page do Pages
 * ele fica em /questoes-concurso/robots.txt e o crawler consulta o da raiz
 * (gabriel-braga-ol.github.io/robots.txt) — o arquivo fica aqui para
 * documentar a regra, apontar o sitemap e já estar certo se o site ganhar
 * domínio próprio.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: `${BASE_PATH}/`,
    },
    sitemap: `${SITE_URL}sitemap.xml`,
  };
}
