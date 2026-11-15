"use client";

import dynamic from "next/dynamic";

/**
 * O Excalidraw é pesado e depende de `window`, então só entra no bundle
 * depois que o usuário pede para desenhar, e nunca é renderizado no
 * servidor. Antes disso a página carrega leve.
 */
const ExcalidrawCanvas = dynamic(() => import("./ExcalidrawCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      Carregando prancheta…
    </div>
  ),
});

export function DrawingBoard({
  storageKey,
  onExit,
}: {
  storageKey: string;
  onExit: () => void;
}) {
  return <ExcalidrawCanvas storageKey={storageKey} onExit={onExit} />;
}
