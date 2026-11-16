import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Serve o `out/` do jeito que o GitHub Pages serve uma *project page*: tudo
 * pendurado em `/questoes-concurso/`. É só para conferir o build localmente;
 * em produção quem serve é o Pages. O prefixo espelha `src/lib/site.ts`.
 */
const ROOT = path.resolve(import.meta.dirname, "..", "out");
const BASE_PATH = "/questoes-concurso";
const PORT = Number(process.env.PORT ?? 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** o Pages resolve /rota/ para /rota/index.html; o resto é arquivo direto */
async function resolveFile(urlPath) {
  if (!urlPath.startsWith(BASE_PATH)) return null;

  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const relative = clean.slice(BASE_PATH.length) || "/";
  const candidates = [
    path.join(ROOT, relative),
    path.join(ROOT, relative, "index.html"),
    path.join(ROOT, `${relative}.html`),
  ];

  for (const candidate of candidates) {
    if (!candidate.startsWith(ROOT + path.sep)) continue;
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (!url.startsWith(BASE_PATH)) {
    res.writeHead(302, { location: `${BASE_PATH}${url}` });
    res.end();
    return;
  }

  const file = await resolveFile(url);
  if (!file) {
    const notFound = await readFile(path.join(ROOT, "404.html")).catch(() => null);
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(notFound ?? "404");
    return;
  }

  const body = await readFile(file);
  res.writeHead(200, {
    "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
  });
  res.end(body);
}).listen(PORT, () => {
  console.log(`servindo out/ em http://localhost:${PORT}${BASE_PATH}/`);
});
