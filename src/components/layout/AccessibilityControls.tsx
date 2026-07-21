import { useEffect, useState } from "react";

const STORAGE_KEY = "origem-conecta-font-scale";

export function AccessibilityControls() {
  const [scale, setScale] = useState<"normal" | "large" | "xlarge">("normal");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = stored === "large" || stored === "xlarge" ? stored : "normal";
    setScale(initial);
    document.documentElement.dataset.fontScale = initial;
  }, []);

  const toggle = () => {
    const next = scale === "normal" ? "large" : scale === "large" ? "xlarge" : "normal";
    setScale(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.fontScale = next;
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title="Alterar tamanho do texto"
      aria-label={`Tamanho do texto: ${scale === "normal" ? "normal" : scale === "large" ? "maior" : "máximo"}. Clique para alterar.`}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-bold transition-colors ${
        scale !== "normal"
          ? "border-leaf-600 bg-leaf-100 text-brand-900"
          : "border-border bg-white text-brand-900 hover:border-leaf-500"
      }`}
    >
      <span aria-hidden="true">{scale === "normal" ? "A" : scale === "large" ? "A+" : "A++"}</span>
    </button>
  );
}
