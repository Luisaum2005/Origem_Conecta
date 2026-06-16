import { ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "origem-conecta-font-scale";

export function AccessibilityControls() {
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === "large";
    setLargeText(stored);
    document.documentElement.dataset.fontScale = stored ? "large" : "normal";
  }, []);

  const toggle = () => {
    const next = !largeText;
    setLargeText(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "large" : "normal");
    document.documentElement.dataset.fontScale = next ? "large" : "normal";
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={largeText ? "Voltar ao tamanho normal" : "Aumentar fonte"}
      aria-label={largeText ? "Voltar ao tamanho normal" : "Aumentar fonte"}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
        largeText
          ? "border-leaf-600 bg-leaf-100 text-brand-900"
          : "border-border bg-white text-brand-900 hover:border-leaf-500"
      }`}
    >
      <ZoomIn className="h-4 w-4" />
      <span className="hidden md:inline">Fonte</span>
    </button>
  );
}
