import { type ReactNode } from "react";

export function FormProgress({
  step,
  total,
  hint,
}: {
  step: number;
  total: number;
  hint?: string;
}) {
  const pct = (step / total) * 100;
  return (
    <div className="mb-6">
      <div className="flex flex-col items-start gap-1 text-sm font-medium text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Etapa {step} de {total}
        </span>
        {hint && <span className="text-leaf-700">{hint}</span>}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-leaf-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function FormSection({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-border bg-white p-5">
      <legend className="px-2">
        <span className="text-sm font-semibold text-brand-900">{title}</span>
        {caption && <span className="ml-2 text-xs text-muted-foreground">{caption}</span>}
      </legend>
      {children}
    </fieldset>
  );
}
