import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-6">
        <Logo />
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-brand-900"
        >
          <ArrowLeft className="h-4 w-4" /> Início
        </Link>
      </header>
      <main className="mx-auto flex max-w-[560px] flex-col px-6 pb-16 pt-8">
        <h1 className="text-3xl font-bold tracking-tight text-brand-900">{title}</h1>
        {subtitle && <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
      </main>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  placeholder,
  helper,
  required,
  ...inputProps
}: {
  label: string;
  type?: string;
  placeholder?: string;
  helper?: string;
  required?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "placeholder" | "required">) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">
        {label}
        {required && <span className="ml-1 text-orange-600">*</span>}
      </span>
      <input
        {...inputProps}
        type={type}
        placeholder={placeholder}
        required={required}
        className="mt-2 h-[52px] w-full rounded-xl border border-border bg-white px-4 text-base text-brand-900 placeholder:text-[var(--text-tertiary)] focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
      />
      {helper && <span className="mt-1.5 block text-xs text-muted-foreground">{helper}</span>}
    </label>
  );
}

export function PrimaryButton({
  children,
  loading,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      className="inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand-900 px-6 text-base font-semibold text-white shadow-xs transition-colors hover:bg-brand-800 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
    >
      {loading ? "Enviando…" : children}
    </button>
  );
}

export function useFakeSubmit(onSuccess: () => void) {
  const [loading, setLoading] = useState(false);
  return {
    loading,
    onSubmit: (e: FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        onSuccess();
      }, 700);
    },
  };
}
