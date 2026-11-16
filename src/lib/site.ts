/**
 * O site é publicado como *project page* do GitHub Pages: o repositório
 * `questoes-concurso` responde em
 * https://gabriel-braga-ol.github.io/questoes-concurso/.
 *
 * `next/link` aplica o `basePath` sozinho. O que não passa por ele — as imagens
 * das questões, por exemplo — precisa do prefixo na mão (`assetPath`).
 */
export const OWNER = "Gabriel-braga-ol";
export const REPO = "questoes-concurso";

const DEPLOY_BASE_PATH = `/${REPO}`;

/** no `npm run dev` o site fica na raiz; o build de produção usa o subdiretório */
export const BASE_PATH =
  process.env.NODE_ENV === "production" ? DEPLOY_BASE_PATH : "";

/** endereço canônico publicado, com barra no fim como o resto do site */
export const SITE_URL = `https://${OWNER.toLowerCase()}.github.io${DEPLOY_BASE_PATH}/`;

/** repositório público: é por ele (Issues) que o contato acontece */
export const REPO_URL = `https://github.com/${OWNER}/${REPO}`;

/** prefixa um caminho de `public/` para o subdiretório de publicação */
export function assetPath(src: string) {
  return src.startsWith("/") ? `${BASE_PATH}${src}` : src;
}
