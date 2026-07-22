import { SUPPLIER_PRODUCT_GROUPS } from "@/lib/hortifruti";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type SupplierProductPickerProps = {
  value: string[];
  onChange: (products: string[]) => void;
  required?: boolean;
};

export function SupplierProductPicker({
  value,
  onChange,
  required = false,
}: SupplierProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const labelId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return SUPPLIER_PRODUCT_GROUPS;
    return SUPPLIER_PRODUCT_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.toLowerCase().includes(normalizedQuery)),
    })).filter((group) => group.items.length);
  }, [query]);
  const visibleProducts = useMemo(() => filtered.flatMap((group) => group.items), [filtered]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const focusProduct = (index: number) => {
    if (visibleProducts.length === 0) return;
    const bounded = Math.max(0, Math.min(index, visibleProducts.length - 1));
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-product-index="${bounded}"]`)?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (product: string) =>
    onChange(
      value.includes(product) ? value.filter((item) => item !== product) : [...value, product],
    );

  return (
    <div ref={rootRef}>
      <span id={labelId} className="block text-sm font-medium text-brand-900">
        O que você produz ou fornece?
        {required && <span className="ml-1 text-orange-600">*</span>}
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        className="mt-2 flex min-h-[52px] w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-left text-base text-brand-900 hover:border-leaf-500 focus-visible:border-leaf-600 focus-visible:ring-2 focus-visible:ring-leaf-100"
      >
        <span className="truncate text-muted-foreground">
          {value.length === 0
            ? "Selecione os produtos que você fornece"
            : `${value.length} produto${value.length > 1 ? "s" : ""} selecionado${value.length > 1 ? "s" : ""}`}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((product) => (
            <span
              key={product}
              className="inline-flex items-center gap-1.5 rounded-full bg-leaf-100 px-3 py-1 text-xs font-medium text-brand-900"
            >
              {product}
              <button
                type="button"
                onClick={() => toggle(product)}
                aria-label={`Remover ${product}`}
                className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-white hover:text-orange-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 rounded-2xl border border-border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto"
              aria-label="Buscar produto na lista"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  focusProduct(0);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  focusProduct(visibleProducts.length - 1);
                } else if (event.key === "Escape") close();
              }}
              className="h-11 w-full bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-600"
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            className="max-h-72 overflow-y-auto py-2"
          >
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Produto não encontrado. Entre em contato com o suporte para solicitar a inclusão.
              </p>
            )}
            {filtered.map((group) => (
              <div key={group.group} className="px-2 py-1">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.group}
                </p>
                <ul>
                  {group.items.map((product) => {
                    const active = value.includes(product);
                    const productIndex = visibleProducts.indexOf(product);
                    return (
                      <li key={product}>
                        <button
                          type="button"
                          onClick={() => toggle(product)}
                          role="option"
                          aria-selected={active}
                          data-product-index={productIndex}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              focusProduct((productIndex + 1) % visibleProducts.length);
                            } else if (event.key === "ArrowUp") {
                              event.preventDefault();
                              focusProduct(
                                (productIndex - 1 + visibleProducts.length) %
                                  visibleProducts.length,
                              );
                            } else if (event.key === "Home") {
                              event.preventDefault();
                              focusProduct(0);
                            } else if (event.key === "End") {
                              event.preventDefault();
                              focusProduct(visibleProducts.length - 1);
                            }
                          }}
                          className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base focus-visible:ring-2 focus-visible:ring-leaf-600 ${
                            active ? "bg-leaf-100 text-brand-900" : "text-brand-900 hover:bg-canvas"
                          }`}
                        >
                          <span>{product}</span>
                          {active && <Check className="h-4 w-4 text-leaf-700" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
