"use client";

import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";

/** cor padrão da caneta: vermelho de caneta de correção, visível sobre texto */
const STROKE = "#dc2626";

type StoredScene = {
  elements: ExcalidrawInitialDataState["elements"];
};

function loadScene(key: string): StoredScene | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredScene;
    if (!Array.isArray(parsed.elements)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeScene(storageKey: string, elements: readonly unknown[]) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ elements, savedAt: Date.now() }),
    );
  } catch {
    // localStorage cheio ou bloqueado: desenhar continua funcionando
  }
}

export default function ExcalidrawCanvas({
  storageKey,
  onExit,
}: {
  storageKey: string;
  onExit: () => void;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<readonly unknown[]>([]);
  /** o primeiro onChange é o do próprio Excalidraw montando: nada a salvar */
  const firstChange = useRef(true);

  // lido uma única vez no primeiro render (o componente só existe no cliente)
  const [initialData] = useState<ExcalidrawInitialDataState>(() => {
    const stored = loadScene(storageKey);
    return {
      elements: stored?.elements ?? [],
      appState: {
        viewBackgroundColor: "transparent",
        currentItemStrokeColor: STROKE,
        currentItemStrokeWidth: 2,
        // o padrão do Excalidraw é a ferramenta de seleção, que transforma o
        // primeiro arrasto numa caixa de seleção. Quem abriu a prancheta quer
        // riscar na hora, então já entra com o lápis.
        activeTool: {
          type: "freedraw",
          customType: null,
          lastActiveTool: null,
          locked: false,
        },
      },
    };
  });

  // fecha com Esc
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      // Esc dentro do editor de texto do Excalidraw deve só sair da edição
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "INPUT" ||
        target?.isContentEditable
      ) {
        return;
      }

      onExit();
    }

    // fase de captura: o Excalidraw também trata Esc e interrompe a propagação
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onExit]);

  /*
    Trava a rolagem só enquanto a prancheta cobre a tela (abaixo de `lg`). A
    partir daí ela é um painel ao lado e o enunciado precisa continuar rolando.
  */
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const persist = useCallback(
    (elements: readonly unknown[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        writeScene(storageKey, elements);
        setSaved(true);
        setTimeout(() => setSaved(false), 1400);
      }, 400);
    },
    [storageKey],
  );

  // ao sair da prancheta, grava o que ainda estava no debounce
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (latest.current.length) writeScene(storageKey, latest.current);
    };
  }, [storageKey]);

  const handleExport = useCallback(async () => {
    if (!api) return;
    const blob = await exportToBlob({
      elements: api.getSceneElements(),
      appState: {
        ...api.getAppState(),
        exportBackground: true,
        viewBackgroundColor: "#ffffff",
      },
      files: api.getFiles(),
      mimeType: "image/png",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `myvest-${storageKey.split(":").at(-1) ?? "questao"}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [api, storageKey]);

  const handleClear = useCallback(() => {
    api?.updateScene({ elements: [] });
    api?.history.clear();
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* noop */
    }
  }, [api, storageKey]);

  return (
    /*
      No celular e no tablet em pé a prancheta cobre a tela e fica transparente
      sobre o texto — é a proposta original. A partir de `lg` ela vira um painel
      à direita: o enunciado continua legível e rolável, sem fechar a prancheta
      para ler o resto da questão.
    */
    <div className="drawing-layer fixed inset-0 z-50 lg:top-14 lg:left-auto lg:w-1/2 lg:border-l lg:border-line lg:bg-paper">
      {/*
        Controles próprios: o menu nativo do Excalidraw é escondido via CSS.
        Eles ficam embaixo porque em cima a barra de ferramentas do Excalidraw
        (~510px) chega perto da borda — num painel de metade da tela os dois
        brigariam pelo mesmo canto.
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 flex items-center justify-center gap-2 px-4">
        <span className="pointer-events-none hidden rounded-md bg-ink/70 px-2 py-1 text-[11px] text-white sm:inline">
          {saved ? "Desenho salvo" : "Prancheta"}
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="pointer-events-auto rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-stone-700 shadow-sm transition hover:border-red-200 hover:text-red-600"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="pointer-events-auto rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-stone-700 shadow-sm transition hover:border-brand/30 hover:text-brand-dark"
        >
          PNG
        </button>
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto rounded-lg bg-ink px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition hover:bg-stone-700"
        >
          Concluir
        </button>
      </div>

      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        langCode="pt-BR"
        theme="light"
        detectScroll={false}
        autoFocus
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveAsImage: false,
            saveToActiveFile: false,
            toggleTheme: null,
          },
          tools: { image: false },
        }}
        onChange={(elements) => {
          latest.current = elements;
          if (firstChange.current) {
            firstChange.current = false;
            return;
          }
          persist(elements);
        }}
      />
    </div>
  );
}

export { STROKE };
