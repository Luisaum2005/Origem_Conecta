import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { AccessibilityControls } from "@/components/layout/AccessibilityControls";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";

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
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-5 sm:px-8 sm:py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <AccessibilityControls />
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-brand-900"
          >
            <ArrowLeft className="h-4 w-4" /> Início
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-[620px] flex-col px-4 pb-16 pt-4 sm:px-6 sm:pt-8">
        <div className="rounded-2xl border border-border bg-white/70 p-5 shadow-xs sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {subtitle}
            </p>
          )}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
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
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const fieldName = String(inputProps.name ?? "");
  const handleInput = (event: React.InputEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const digits = input.value.replace(/\D/g, "");
    if (fieldName.toLowerCase().includes("cnpj")) {
      input.value = digits
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    } else if (fieldName === "cep") {
      input.value = digits.slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
    } else if (fieldName === "telefone") {
      input.value = digits
        .slice(0, 11)
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d{4})$/, "$1-$2");
    }
    inputProps.onInput?.(event);
  };
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">
        {label}
        {required && <span className="ml-1 text-orange-600">*</span>}
      </span>
      <span className="relative mt-2 block">
        <input
          {...inputProps}
          type={isPassword && showPassword ? "text" : type}
          placeholder={placeholder}
          required={required}
          onInput={handleInput}
          pattern={
            inputProps.pattern ??
            (fieldName === "cep"
              ? "[0-9]{5}-?[0-9]{3}"
              : fieldName === "telefone"
                ? "[0-9()\\s-]{14,15}"
                : undefined)
          }
          title={
            inputProps.title ??
            (fieldName === "cep"
              ? "Informe um CEP com 8 números."
              : fieldName === "telefone"
                ? "Informe o DDD e o número do telefone."
                : undefined)
          }
          inputMode={
            inputProps.inputMode ??
            (fieldName === "cep" ||
            fieldName === "telefone" ||
            fieldName.toLowerCase().includes("cnpj")
              ? "numeric"
              : undefined)
          }
          className={`h-[52px] w-full rounded-xl border border-border bg-white px-4 text-base text-brand-900 placeholder:text-[var(--text-tertiary)] focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100 ${isPassword ? "pr-14" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-1 right-1 grid w-11 place-items-center rounded-lg text-brand-700 hover:bg-secondary"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </span>
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
      disabled={loading || rest.disabled}
      className="inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand-900 px-6 text-base font-semibold text-white shadow-xs transition-colors hover:bg-brand-800 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
    >
      {loading ? "Enviando..." : children}
    </button>
  );
}
