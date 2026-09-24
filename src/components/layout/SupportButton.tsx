import { MessageCircle } from "@/components/mobile/icons";
import { supportHref } from "@/lib/support";

export function SupportButton({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={supportHref}
      target={supportHref.startsWith("http") ? "_blank" : undefined}
      rel={supportHref.startsWith("http") ? "noreferrer" : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white font-semibold text-brand-900 shadow-xs transition-colors hover:border-leaf-500 hover:bg-secondary ${
        compact ? "h-11 min-w-11 px-3 text-xs" : "h-11 px-4 text-sm"
      }`}
    >
      <MessageCircle className="h-4 w-4 text-leaf-700" />
      <span className={compact ? "hidden sm:inline" : undefined}>Suporte</span>
    </a>
  );
}
