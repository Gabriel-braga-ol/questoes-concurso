# MyVest

Questões de vestibular para resolver **rabiscando em cima do enunciado**.

O objetivo é reduzir cliques: uma tela com filtros instantâneos, uma questão por
página e uma prancheta transparente sobre o texto para fazer conta, marcar
alternativa e riscar o que já foi descartado.

Projeto gratuito, sem fins comerciais. Hoje o acervo cobre o **ENEM de 2019 a
2023** (891 questões).

## Como rodar

```bash
npm install
npm run dev          # http://localhost:3000
```

Outros comandos:

```bash
npm run build        # gera o site estático em out/
npm run start        # serve out/ localmente
npm run typecheck    # tsc --noEmit
npm run lint
```

O build usa `output: "export"`: o resultado é HTML/CSS/JS puro, publicável em
qualquer host estático (GitHub Pages, Cloudflare Pages, Netlify, S3…). Não há
backend nem banco de dados.

## Estrutura

```
scripts/
  ingest-enem.mjs     baixa as questões, salva imagens e gera os JSON
  topics.mjs          classificação de matéria/assunto por radicais
src/
  app/                rotas (App Router)
    page.tsx          home com filtros
    questao/[id]/     página da questão, gerada no build
    sobre/            fontes, direitos e limitações
  components/
    QuestionExplorer  filtros, busca e lista (client-side)
    QuestionView      enunciado, alternativas e gabarito
    DrawingBoard      carrega o Excalidraw só quando o usuário pede
    ExcalidrawCanvas  prancheta, persistência local, export PNG
  data/
    questions.json    questões completas (usado só no build)
    catalog.json      versão enxuta usada pela home
    meta.json         totais por matéria
  lib/
    catalog.ts        helpers de filtro, contagem e busca
    questions.ts      leitura das questões (server-only)
```

## Ingestão

```bash
node scripts/ingest-enem.mjs                # 2019–2023
node scripts/ingest-enem.mjs 2022 2023      # anos específicos
```

O script:

1. baixa todas as questões do ano pela API pública
   [api.enem.dev](https://api.enem.dev) (limite de 50 por página);
2. baixa as imagens para `public/img/enem/<ano>/` — nada de hotlink;
3. descarta duplicatas (a API repete alguns índices) e questões sem alternativas;
4. classifica matéria e assunto;
5. regrava `src/data/*.json`.

Requer Node 20+ (usa `fetch` nativo). A API externa é usada **só na ingestão**:
em produção o site não faz nenhuma chamada para ela.

### Sobre a classificação

A API informa apenas a grande área (`matematica`, `ciencias-natureza`,
`ciencias-humanas`, `linguagens`). A divisão em `Matemática > Probabilidade` é
derivada em `scripts/topics.mjs` com regras de radicais (`probabilidad`,
`funco`, `porcentag`…), porque a palavra aparece flexionada no enunciado.

É heurística: acerta a maioria, erra questões interdisciplinares e manda os casos
ambíguos para **Outros temas**. A interface avisa isso. Para melhorar, o caminho
é ajustar as listas em `topics.mjs` ou trocar `classify()` por um classificador
de verdade — o resto do pipeline não muda.

## Prancheta

A camada de desenho é o [Excalidraw](https://excalidraw.com) (MIT) com fundo
transparente, carregado sob demanda (`ssr: false`). Recursos:

- lápis já selecionado ao abrir, para riscar sem escolher ferramenta;
- caneta vermelha, formas geométricas, texto e borracha;
- desenho salvo no `localStorage` por questão (debounce de 400 ms, gravação
  garantida ao sair);
- exportação em PNG e limpeza do quadro.

Nada é enviado para servidor: o desenho fica no navegador do usuário.

## Limitações conhecidas

- Só ENEM por enquanto; FUVEST, UNICAMP, CEDERJ e concursos ainda não têm
  ingestão.
- Questões de outras línguas aparecem como matérias próprias (Inglês/Espanhol)
  quando a API identifica o idioma.
- O assunto é estimado — trate como atalho de navegação, não como verdade.
- A prancheta cobre a tela inteira e trava a rolagem do fundo. Em enunciados
  que não cabem numa tela, o ajuste é riscar o trecho visível, fechar
  (`Concluir` ou `Esc`), rolar e reabrir: o desenho é salvo por questão e
  reaparece onde estava.
- A página da questão é imutável (gerada no build): para atualizar o acervo é
  preciso rodar a ingestão e o build de novo.

## Fontes e direitos

Questões e imagens do ENEM são de domínio público (INEP), obtidas via
[enem.dev](https://enem.dev). Cada questão exibe ano e número originais. O texto
oficial é sempre a referência. Pedidos de correção ou remoção: veja a página
`/sobre`.
