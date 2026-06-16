import { MessageCircle } from "lucide-react";

const supportHref =
  (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ||
  "mailto:origemconecta@gmail.com";

export function SupportButton({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={supportHref}
      target={supportHref.startsWith("http") ? "_blank" : undefined}
      rel={supportHref.startsWith("http") ? "noreferrer" : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white font-semibold text-brand-900 shadow-xs transition-colors hover:border-leaf-500 hover:bg-secondary ${
        compact ? "h-10 px-3 text-xs" : "h-11 px-4 text-sm"
      }`}
    >
      <MessageCircle className="h-4 w-4 text-leaf-700" />
      <span className={compact ? "hidden sm:inline" : undefined}>Suporte</span>
    </a>
  );
}
