# AGENTS.md

Regras para agentes de IA neste repositório. O README explica o produto; aqui
ficam comandos, limites e critérios de pronto.

**Antes de alterar qualquer código, leia `README.md` e este `AGENTS.md` até o
fim.** O README diz o que o produto é e por quê; este arquivo diz como trabalhar
aqui e o que conta como pronto.

## Comandos

- `npm run dev` — servidor local em http://localhost:3000.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — ESLint com a config do Next.
- `npm run build` — export estático em `out/`.
- `npm run ingest` — regenera o acervo do ENEM.
- `npm run start` — serve `out/` localmente.

Node mínimo: **20.11** (`import.meta.dirname` no script de ingestão). O
`package.json` ainda não declara `engines`.

Para limitar a ingestão a alguns anos, use `npm run ingest -- 2022 2023`. Isso
**substitui** o acervo inteiro, não acrescenta anos.

## Definição de pronto

- `npm run typecheck` e `npm run lint` passam sem erros antes de concluir.
- Rode `npm run build` se mexer em rotas, `next.config.ts`, `src/data/**` ou
  `public/img/**`.
- Não introduza warnings novos. Os três avisos de `<img>` em
  `src/components/QuestionView.tsx` já são conhecidos.
- Ao terminar, diga o que mudou e como verificou.

## Arquivos gerados

Não edite à mão:

- `src/data/questions.json`, `src/data/catalog.json`, `src/data/meta.json`;
- `public/img/enem/**`.

Regenere com `npm run ingest` (ou `node scripts/ingest-enem.mjs <anos>`). A
ingestão baixa da API, salva as imagens e classifica matéria/assunto em
`scripts/topics.mjs`. Dados regenerados vão em commit próprio.

## Princípios

SOLID e Clean Code com pragmatismo, traduzidos em regras concretas:

- Uma responsabilidade por função/componente. Referência: ~30 linhas por função e
  ~150 por componente; se passar, divida. Arquivos legados acima disso não
  justificam refatoração fora do escopo.
- Lógica fora do JSX: cálculo e transformação em funções puras em `src/lib`;
  estado e efeitos reutilizáveis em `src/hooks` (crie quando houver o primeiro
  caso real).
- Dados só por `src/lib/catalog.ts` e `src/lib/questions.ts`. Componentes não
  importam JSON de `src/data` diretamente.
- Abstraia na segunda ocorrência real. Nada de interface, factory ou camada
  "para o futuro".
- Nomes dizem a intenção (`resolveTopic`, não `helper2`). Comentários explicam o
  porquê; o código já mostra o como.
- Sem `any`, sem `@ts-ignore` e sem `eslint-disable` sem justificativa no mesmo
  commit.
- Não adicione dependência sem perguntar.
- `questions.json` só pode ser lido por Server Components; ele não deve entrar no
  bundle do cliente.

## Idioma

- Identificadores (variáveis, funções, tipos, arquivos de código) em inglês.
- Interface, comentários, documentação, mensagens de erro e commits em português.

## Commits

- Conventional Commits em português: `tipo(escopo): resumo no imperativo`, até 72
  caracteres.
- Um commit = uma mudança lógica que passa em typecheck e lint.
- Não misture refatoração com mudança de comportamento.
- Dados regenerados (`src/data/**`, `public/img/**`) em commit próprio.
- O corpo explica o porquê; o diff já mostra o como.

## Como trabalhar

- Tarefa ambígua ou que muda arquitetura: pergunte antes.
- Leia `README.md` e este arquivo antes de mexer no código; em tarefa de dados,
  leia também o script de ingestão que gera o arquivo afetado.
- Faça a menor mudança que resolve o problema; não refatore fora do escopo.
- Não altere dados, configuração ou dependências por conveniência.
- Ao terminar, diga o que mudou, como verificou e o que ficou em aberto.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
