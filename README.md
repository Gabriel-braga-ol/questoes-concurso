# MyVest

Questões de vestibular para resolver **rabiscando em cima do enunciado**. A ideia
é reduzir cliques: uma tela com filtros instantâneos, uma questão por página e uma
prancheta transparente sobre o texto para fazer conta, marcar alternativa e
riscar o que já foi descartado.

<!--
  Espaço para o GIF/print da prancheta.
  Coloque a imagem em docs/ (sugestão: docs/prancheta.gif) e descomente:

  ![Prancheta do MyVest sobre um enunciado](docs/prancheta.gif)
-->

Projeto gratuito, sem fins comerciais. Hoje o acervo cobre o **ENEM de 2019 a
2023** (914 questões).

## Como rodar

O `package.json` **não declara o campo `engines`** — ele precisa ser adicionado.
Na prática, o mínimo é **Node 20.11 ou superior**: o script de ingestão usa
`import.meta.dirname`, disponível a partir dessa versão, e o Next 16 exige
`>= 20.9`.

```bash
npm install
npm run dev          # http://localhost:3000
```

Outros comandos:

```bash
npm run build        # export estático em out/
npm run start        # serve out/ em http://localhost:3000/questoes-concurso/
npm run typecheck    # next typegen && tsc --noEmit
npm run lint         # ESLint
npm run ingest       # regenera o acervo do ENEM
```

O build usa `output: "export"` e `trailingSlash: true`: o resultado é um conjunto
de arquivos estáticos em `out/`. Não há backend, banco de dados nem chamada à API
externa em tempo de execução.

## Publicação

O site roda como *project page* do GitHub Pages, em
**https://gabriel-braga-ol.github.io/questoes-concurso/**. Cada push na `main`
dispara `.github/workflows/deploy.yml`, que roda `npm ci && npm run build` e
publica `out/` com as actions oficiais do Pages.

Como o Pages serve o repositório num subdiretório, o build de produção usa
`basePath: "/questoes-concurso"` (`src/lib/site.ts`). O `next/link` aplica o
prefixo sozinho; imagens e outros arquivos de `public/` passam por `assetPath()`,
porque o Next não reescreve `src` de `<img>`. No `npm run dev` o prefixo é vazio,
então o site fica em http://localhost:3000.

Duas configurações fora do código:

- **Settings → Pages → Source: GitHub Actions** (sem isso o job de deploy falha).
- O repositório precisa ser público — Pages em repositório privado exige plano
  pago.

Para conferir o build antes de subir, `npm run build && npm run start` serve o
`out/` no mesmo subdiretório que o Pages usa. Se um dia o site for para a raiz do
domínio (domínio próprio ou *user page*), basta zerar `DEPLOY_BASE_PATH` em
`src/lib/site.ts`.

O export estático do Next não gera alguns payloads de prefetch de rota
(`__next.*.__PAGE__.txt`): o navegador registra 404 no console e a navegação cai
para carregamento normal da página. Funciona, mas é o motivo daqueles 404.

## Estrutura e fluxo dos dados

```
api.enem.dev
   │  npm run ingest
   ▼
src/data/*.json  +  public/img/enem/<ano>/
   │  npm run build
   ▼
out/ (arquivos estáticos)
```

```
scripts/
  ingest-enem.mjs     baixa as questões, salva imagens e gera os JSON
  topics.mjs          classificação de matéria/assunto por radicais
  serve-out.mjs       serve out/ no subdiretório do Pages (npm run start)
src/
  app/                rotas (App Router)
    layout.tsx        cabeçalho, rodapé e metadados
    page.tsx          home com filtros
    questao/[id]/     página da questão, gerada no build
    sobre/            fontes, direitos e limitações
  components/
    QuestionExplorer  filtros, busca e lista (client-side)
    QuestionView      enunciado, alternativas e gabarito
    DrawingBoard      carrega o Excalidraw só quando o usuário pede
    ExcalidrawCanvas  prancheta, persistência local, export PNG
  data/
    questions.json    questões completas (lidas só no build)
    catalog.json      versão enxuta importada pela home
    meta.json         totais por matéria e anos
    ingest-report.json  o que ficou de fora da API e por quê
  lib/
    catalog.ts        helpers de filtro, contagem e busca
    questions.ts      leitura das questões (server-only)
    site.ts           endereço publicado, basePath e assetPath
    types.ts          tipos de questão, catálogo e metadados
public/
  img/enem/<ano>/     imagens copiadas na ingestão
```

Os quatro arquivos de `src/data/` são gerados. `catalog.json` é a versão enxuta
(id, ano, matéria, assunto, prévia e flags) importada pelo cliente — é o que
permite filtrar sem estado de loading. `questions.json` tem a questão completa e
é lido com `fs` apenas no build, para não entrar no bundle do navegador.
`meta.json` alimenta os totais exibidos na home e `ingest-report.json` registra as
questões descartadas (com motivo) e os números que a API não devolveu.

## Ingestão

```bash
npm run ingest                 # anos padrão: 2019–2023
npm run ingest -- 2022 2023    # apenas esses anos
```

Também é possível chamar o script direto:

```bash
node scripts/ingest-enem.mjs
node scripts/ingest-enem.mjs 2022 2023
```

O script:

1. baixa todas as questões do ano pela API pública
   [api.enem.dev](https://api.enem.dev) (paginação de 50 por página) em **duas
   passadas**: sem filtro (espanhol) e com `language=ingles`. As questões 1 a 5
   existem nos dois idiomas com o mesmo número, por isso o idioma entra no id
   (`enem-2023-1-es`, `enem-2023-1-en`);
2. baixa as imagens para `public/img/enem/<ano>/` e reescreve o markdown para os
   caminhos locais — nada de hotlink. Nomes já baixados são reaproveitados, então
   reingerir não rebaixa 33 MB de imagens;
3. descarta e registra o motivo: itens que a API repete entre páginas, o mesmo
   conteúdo devolvido nas duas passadas (acontece na questão 5 de 2020) e questões
   com menos de duas alternativas válidas;
4. classifica matéria e assunto;
5. regrava `src/data/questions.json`, `catalog.json`, `meta.json` e
   `ingest-report.json`.

A API responde `429` quando é consultada em sequência e às vezes sugere esperar
mais de uma hora no `Retry-After`. O script trata isso como sugestão com teto de
60 s, dá 400 ms entre páginas e tem timeout de 20 s por requisição — sem isso a
ingestão ficava parada por mais de uma hora.

Atenção: a ingestão regrava os JSON do zero. Rodar com anos específicos
**substitui o acervo**, não acrescenta anos aos existentes.

A API externa é usada **só na ingestão**: em produção o site não faz nenhuma
chamada para ela.

A soma não fecha em 180 por ano porque a própria API não devolve todas as
questões: 2019 (98, 100, 128), 2020 (144, 168, 179) e 2023 (34, 132, 174) estão
ausentes da fonte, provavelmente anuladas. `ingest-report.json` lista ano a ano o
que faltou.

### Sobre a classificação

A API informa a grande área (`matematica`, `ciencias-natureza`,
`ciencias-humanas`, `linguagens`) e, em alguns casos, o idioma. Matéria e assunto
não vêm na fonte: a divisão em `Matemática > Probabilidade` é derivada em
`scripts/topics.mjs` com regras de radicais (`probabilidad`,
`funco`, `porcentag`…), porque a palavra aparece flexionada no enunciado.

É heurística: acerta a maioria, erra questões interdisciplinares e manda os casos
ambíguos para a área genérica (`Ciências Humanas`, `Ciências da Natureza`) e para
**Outros temas** (`Geral`). A interface avisa isso. Cada questão grava a
procedência em `classifiedBy` (hoje `regras@v1`), então dá para reprocessar só o
que foi classificado por uma versão antiga. Para melhorar, o caminho é ajustar as
listas em `topics.mjs` ou trocar `classify()` por um classificador de verdade
(LLM com taxonomia fechada, mantendo as regras como reserva) — o resto do
pipeline não muda.

## Prancheta

A camada de desenho é o [Excalidraw](https://excalidraw.com) (MIT) com fundo
transparente, carregado sob demanda (`ssr: false`). Recursos:

- lápis já selecionado ao abrir, para riscar sem escolher ferramenta;
- caneta vermelha, formas geométricas, texto e borracha;
- desenho salvo no `localStorage` por questão (debounce de 400 ms, gravação
  garantida ao sair);
- exportação em PNG e limpeza do quadro.

A partir de `lg` (1024 px) a prancheta vira um **painel à direita**: o enunciado
fica na metade esquerda, legível e rolável, e o traço continua disponível ao lado
do texto. Abaixo disso — celular e tablet em pé — ela cobre a tela, transparente
sobre o enunciado, que é a proposta original do produto: riscar em cima do texto.
O painel precisa de ~510 px para a barra de ferramentas do Excalidraw caber; por
isso o corte é 1024 e não 768.

Nada é enviado para servidor: o desenho fica no navegador do usuário.

## Decisões de arquitetura

### Por que site estático

O acervo atual tem 914 questões e o catálogo completo cabe em algumas centenas de
KB de JSON. Importá-lo no cliente permite filtro e busca instantâneos, sem
requisição, loading ou API. Sem backend também não há servidor para manter, banco
para pagar nem superfície de autenticação; o deploy é um push na `main`. E o
desenho, que é o diferencial do produto, fica local por padrão.

O custo é aceitar que o conteúdo é imutável entre builds e que a busca acontece
em cima do catálogo, não do texto integral.

### Por que a ingestão acontece no build

A API pública é dependência de terceiros: pode ficar lenta, mudar de contrato ou
sair do ar. Deixá-la fora do caminho do usuário significa que o site carrega
mesmo se ela cair. O resultado da ingestão é versionado em JSON e imagens locais,
o que torna o acervo reproduzível, auditável e independente de hotlink.

Ingestão e aplicação são separadas de propósito: trocar a fonte de dados ou o
classificador não exige mexer na interface.

### Quando migrar para API

A migração para uma API (o plano é C#) passa a fazer sentido quando pelo menos um
destes pontos aparecer:

- atualizar o acervo sem rodar ingestão e build;
- busca no texto completo ou consultas que não caibam no bundle;
- vários vestibulares com volume muito maior;
- contas de usuário, sincronização de desenhos entre dispositivos ou moderação.

O caminho está indicado no `next.config.ts`: remover `output: "export"` e mover a
leitura de `src/lib/questions.ts` para a API. Os tipos de `src/lib/types.ts`
servem de base para o contrato.

## Limitações conhecidas

- Só ENEM por enquanto; FUVEST, UNICAMP, CEDERJ e concursos aparecem como "em
  breve" na interface e ainda não têm ingestão.
- Questões de língua estrangeira: a API devolve espanhol por padrão e inglês só
  com `language=ingles`, então o acervo traz as duas versões (25 de espanhol e 23
  de inglês; 2019 não tem inglês da questão 5 e 2020 não devolve inglês na 5).
  A questão 5 de 2020 vem marcada como `ciencias-humanas` pela própria API.
- Matéria e assunto são estimados por palavras-chave. Trate o assunto como atalho
  de navegação, não como verdade.
- A busca cobre a prévia do enunciado e os metadados (matéria, assunto, ano,
  número), não o texto completo da questão.
- Abaixo de 1024 px a prancheta cobre a tela e trava a rolagem do fundo. Em
  enunciados que não cabem numa tela, o ajuste é riscar o trecho visível, fechar
  (`Concluir` ou `Esc`), rolar e reabrir: o desenho é salvo por questão e
  reaparece onde estava. A partir de 1024 px o painel fica ao lado e a rolagem
  continua livre.
- O desenho fica só no `localStorage` do navegador. Limpar os dados do site ou
  trocar de dispositivo perde o desenho.
- A página da questão é gerada no build: para atualizar o acervo é preciso rodar a
  ingestão e o build de novo.
- As imagens são servidas como estão (`images.unoptimized: true`), sem otimização
  do `next/image`; o lint registra três avisos de `<img>` em `QuestionView.tsx`.

## Roadmap

- Outros vestibulares: FUVEST, UNICAMP, CEDERJ e concursos.
- Melhorar o classificador de matéria/assunto para reduzir os casos em "Outros
  temas".
- API em C# e banco quando o acervo ou o uso justificarem, substituindo a leitura
  dos JSON.

## Fontes e direitos

As questões vêm da API pública [enem.dev](https://api.enem.dev), que organiza
dados do INEP. O repositório da API
([yunger7/enem-api](https://github.com/yunger7/enem-api)) está sob **GNU GPL-2.0**,
e o site da fonte declara que os dados são públicos. O MyVest não verificou a
titularidade nem os termos de uso das provas e imagens; em caso de dúvida,
consulte a fonte e o INEP. O texto oficial é sempre a referência.

O código deste repositório é **MIT** (veja `LICENSE`). O Excalidraw também é MIT.
Cada questão exibe ano e número originais. Pedidos de correção ou remoção: veja a
página `/sobre`.

## Contribuindo

Antes de mexer no código, leia o [AGENTS.md](AGENTS.md): ele tem os comandos, as
regras de arquitetura e a definição de pronto. Em resumo: rode `npm run typecheck`
e `npm run lint` antes de concluir, use `npm run build` quando mexer em rotas,
configuração ou dados, e siga Conventional Commits em português.
