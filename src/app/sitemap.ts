import type { MetadataRoute } from "next";
import { catalog, meta } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

/** rotas de metadados são Route Handlers; no export estático precisam ser fixas */
export const dynamic = "force-static";

/**
 * Um sitemap só com o que muda junto com o acervo: home, /sobre e cada
 * questão. A `lastModified` é a data da ingestão, não a do build — um deploy
 * que só mexeu em CSS não precisa chamar o crawler de volta.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(meta.generatedAt);

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}sobre/`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...catalog.map((entry) => ({
      url: `${SITE_URL}questao/${entry.id}/`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
