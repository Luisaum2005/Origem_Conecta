import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, X } from "@/components/mobile/icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import logoImg from "@/assets/logo.png";

/** Entrar (Figma A2): painel verde com a frase e o cartão sobreposto. */
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
    <div className="m-screen m-s-a2-entrar">
      <div className="m-panel">
        <div className="m-status" />
        <Link to="/" className="m-brand" aria-label="Origem Conecta, página inicial">
          <img src={logoImg} alt="" />
          <span>
            Origem <b>Conecta</b>
          </span>
        </Link>
        <p className="m-q">“A alface que chega de manhã foi colhida de madrugada.”</p>
      </div>
      <section className="m-card m-box">
        <h1>{title}</h1>
        {subtitle && <p className="m-muted">{subtitle}</p>}
        {children}
      </section>
      {footer && <div className="m-new">{footer}</div>}
    </div>
  );
}

/**
 * Telas de acesso com cabeçalho simples (Figma A3–A7): voltar/fechar, etapa opcional,
 * título grande, conteúdo e rodapé fixo com a ação principal.
 */
export function AuthPage({
  screen,
  back = "back",
  closeIcon = false,
  headerTitle,
  headerAction,
  steps,
  eyebrow,
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  screen: string;
  back?: "back" | "close" | (() => void);
  /** Mostra "X" em vez da seta mesmo quando `back` é uma função. */
  closeIcon?: boolean;
  headerTitle?: string;
  headerAction?: ReactNode;
  steps?: { current: number; total: number };
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const goBack =
    typeof back === "function"
      ? back
      : () => {
          if (window.history.length > 1) router.history.back();
          else void router.navigate({ to: "/" });
        };
  return (
    <div className={`m-screen ${screen}`}>
      <div className="m-status" />
      <div className="m-hd">
        <button
          type="button"
          className="m-round"
          onClick={goBack}
          aria-label={back === "close" || closeIcon ? "Fechar" : "Voltar"}
        >
          {back === "close" || closeIcon ? (
            <X className="lucide" aria-hidden />
          ) : (
            <ArrowLeft className="lucide" aria-hidden />
          )}
        </button>
        {headerTitle ? <h1 className="m-step-title">{headerTitle}</h1> : <span />}
        {headerAction ?? (headerTitle ? <span style={{ width: 44 }} /> : null)}
      </div>
      {steps && (
        <div className="m-steps" aria-hidden>
          {Array.from({ length: steps.total }, (_, index) => (
            <i key={index} className={index < steps.current ? "m-on" : undefined} />
          ))}
        </div>
      )}
      {icon && <div className="m-ico">{icon}</div>}
      <div className="m-sh" style={icon ? { paddingTop: "18px" } : undefined}>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="m-form">{children}</div>
      {footer && <div className="m-footer">{footer}</div>}
    </div>
  );
}

export function Field({
  label,
  type = "text",
  placeholder,
  helper,
  required,
  end,
  reveal = true,
  ...inputProps
}: {
  label: string;
  type?: string;
  placeholder?: string;
  helper?: ReactNode;
  required?: boolean;
  /** Ícone ou texto à direita do campo (ex.: confirmação). */
  end?: ReactNode;
  /** Em campos de senha, mostra o botão de exibir (padrão) ou o `end`. */
  reveal?: boolean;
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
    <label className="m-field">
      <span>{label}</span>
      <div className="m-in">
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
        />
        {isPassword && reveal ? (
          <button
            type="button"
            className="m-end"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="lucide" aria-hidden />
            ) : (
              <Eye className="lucide" aria-hidden />
            )}
          </button>
        ) : (
          end && <span className="m-end">{end}</span>
        )}
      </div>
      {helper && <small>{helper}</small>}
    </label>
  );
}

export function PrimaryButton({
  children,
  loading,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <button
      {...rest}
      type={rest.type ?? "submit"}
      disabled={!hydrated || loading || rest.disabled}
      aria-busy={loading || undefined}
      className={`m-btn m-primary${rest.className ? ` ${rest.className}` : ""}`}
    >
      {!hydrated ? "Carregando..." : loading ? "Enviando..." : children}
    </button>
  );
}

export function FormError({ children }: { children?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (children) ref.current?.focus();
  }, [children]);
  if (!children) return null;
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="m-form-error">
      {children}
      <span>Revise os campos e tente novamente.</span>
    </div>
  );
}
