import { AlertTriangle, RefreshCw } from "lucide-react";

type DataLoadErrorProps = {
  title?: string;
  message: string;
  onRetry: () => void;
};

export function DataLoadError({
  title = "N\u00e3o foi poss\u00edvel atualizar os dados",
  message,
  onRetry,
}: DataLoadErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-orange-900"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-300 bg-white px-4 text-sm font-semibold text-orange-900 hover:bg-orange-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export function DataLoading({ label = "Carregando dados..." }: { label?: string }) {
  return (
    <div role="status" className="rounded-2xl border border-border bg-white px-5 py-5 shadow-xs">
      <div className="flex items-center gap-3 text-sm font-semibold text-brand-900">
        <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}
