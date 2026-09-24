import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@/components/mobile/icons";

/** Folha inferior no visual do redesign (canto 28px, fundo creme, sombra .sheet). */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="m-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="m-bsheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="m-bsheet-hd">
          <h2>{title}</h2>
          <button type="button" className="m-round" onClick={onClose} aria-label="Fechar">
            <X className="lucide" aria-hidden />
          </button>
        </div>
        <div className="m-bsheet-bd">{children}</div>
        {footer && <div className="m-bsheet-ft">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Menu do botão redondo "…" dos cabeçalhos. */
export function MoreMenu({
  label,
  icon,
  items,
  buttonClassName = "m-round",
}: {
  label: string;
  icon: React.ReactNode;
  buttonClassName?: string;
  items: { label: string; icon?: React.ReactNode; onSelect: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const close = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return (
    <div className="m-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
      </button>
      {open && (
        <div className="m-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? "m-danger" : undefined}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
