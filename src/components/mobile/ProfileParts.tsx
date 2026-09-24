import { Link } from "@tanstack/react-router";
import { ChevronRight } from "@/components/mobile/icons";
import { useEffect, useState } from "react";

const FONT_SCALE_KEY = "origem-conecta-font-scale";
type Scale = "normal" | "large" | "xlarge";

/** Tamanho do texto (mesma preferência do antigo botão "A/A+/A++"). */
export function TextSizeOptions() {
  const [scale, setScale] = useState<Scale>("normal");
  useEffect(() => {
    const stored = window.localStorage.getItem(FONT_SCALE_KEY);
    setScale(stored === "large" || stored === "xlarge" ? stored : "normal");
  }, []);
  const choose = (next: Scale) => {
    setScale(next);
    window.localStorage.setItem(FONT_SCALE_KEY, next);
    document.documentElement.dataset.fontScale = next;
  };
  return (
    <div className="m-opts" role="radiogroup" aria-label="Tamanho do texto">
      {(
        [
          ["normal", "Normal"],
          ["large", "Maior"],
          ["xlarge", "Máximo"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={scale === value}
          className={`m-pill${scale === value ? " m-sel" : ""}`}
          onClick={() => choose(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type RowProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  warn?: boolean;
} & (
  | { onClick: () => void; to?: never; href?: never }
  | { to: string; onClick?: never; href?: never }
  | { href: string; onClick?: never; to?: never }
);

/** Linha de lista dos perfis (ícone em quadrado suave, título, subtítulo e seta). */
export function ListRow({ icon, title, subtitle, warn, ...action }: RowProps) {
  const body = (
    <>
      <span className="m-ic">{icon}</span>
      <div>
        <b>{title}</b>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <ChevronRight className="lucide" aria-hidden />
    </>
  );
  const className = `m-li${warn ? " m-warn" : ""}`;
  if ("to" in action && action.to)
    return (
      <Link to={action.to} className={className}>
        {body}
      </Link>
    );
  if ("href" in action && action.href)
    return (
      <a
        href={action.href}
        target={action.href.startsWith("http") ? "_blank" : undefined}
        rel={action.href.startsWith("http") ? "noreferrer" : undefined}
        className={className}
      >
        {body}
      </a>
    );
  return (
    <button type="button" className={className} onClick={action.onClick}>
      {body}
    </button>
  );
}
