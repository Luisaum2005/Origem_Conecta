import { SUPPLIER_PRODUCT_GROUPS } from "@/lib/hortifruti";
import { Check, ChevronDown, CirclePlus, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type SupplierProductPickerProps = {
  value: string[];
  onChange: (products: string[]) => void;
  required?: boolean;
  onRequestProduct?: (input: {
    name: string;
    category: string;
    defaultUnit: string;
  }) => Promise<{ status: "active" | "pending"; productName: string; alreadyExisted: boolean }>;
};

export function SupplierProductPicker({
  value,
  onChange,
  required = false,
  onRequestProduct,
}: SupplierProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestCategory, setRequestCategory] = useState("Outros");
  const [requestUnit, setRequestUnit] = useState("unidade");
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");
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

  const requestProduct = async () => {
    const name = query.trim();
    if (!onRequestProduct || name.length < 2) return;
    setRequesting(true);
    setRequestError("");
    setRequestMessage("");
    try {
      const result = await onRequestProduct({
        name,
        category: requestCategory,
        defaultUnit: requestUnit,
      });
      setRequestMessage(
        result.status === "active"
          ? `${result.productName} já está disponível no catálogo.`
          : result.alreadyExisted
            ? `Já existe uma solicitação de ${result.productName} em análise.`
            : `Solicitação de ${result.productName} enviada para análise.`,
      );
      setRequestOpen(false);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Não foi possível enviar a solicitação.",
      );
    } finally {
      setRequesting(false);
    }
  };

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
                Produto não encontrado no catálogo.
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
          {onRequestProduct && filtered.length === 0 && query.trim().length >= 2 && (
            <div className="border-t border-border p-3">
              {!requestOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setRequestOpen(true);
                    setRequestError("");
                    setRequestMessage("");
                  }}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-semibold text-orange-900 hover:bg-orange-100"
                >
                  <CirclePlus className="h-4 w-4" />
                  Não encontrou? Solicitar “{query.trim()}”
                </button>
              ) : (
                <div className="grid gap-3 rounded-xl bg-canvas p-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-900">
                      Solicitar inclusão de “{query.trim()}”
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      O produto ficará em análise antes de aparecer no catálogo público.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-brand-900">
                      Categoria
                      <select
                        value={requestCategory}
                        onChange={(event) => setRequestCategory(event.target.value)}
                        className="h-11 rounded-lg border border-border bg-white px-3 text-base"
                      >
                        <option value="Outros">Outros</option>
                        {SUPPLIER_PRODUCT_GROUPS.map((group) => (
                          <option key={group.group} value={group.group}>
                            {group.group}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-brand-900">
                      Unidade mais usada
                      <select
                        value={requestUnit}
                        onChange={(event) => setRequestUnit(event.target.value)}
                        className="h-11 rounded-lg border border-border bg-white px-3 text-base"
                      >
                        <option value="unidade">Unidade</option>
                        <option value="kg">Quilograma (kg)</option>
                        <option value="g">Grama (g)</option>
                        <option value="litro">Litro</option>
                        <option value="ml">Mililitro (ml)</option>
                        <option value="maço">Maço</option>
                        <option value="caixa">Caixa</option>
                        <option value="dúzia">Dúzia</option>
                        <option value="bandeja">Bandeja</option>
                        <option value="saco">Saco</option>
                      </select>
                    </label>
                  </div>
                  {requestError && (
                    <p role="alert" className="text-sm font-medium text-[var(--color-error-fg)]">
                      {requestError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={requestProduct}
                      disabled={requesting}
                      className="inline-flex h-11 items-center rounded-lg bg-leaf-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {requesting ? "Enviando..." : "Enviar para análise"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestOpen(false)}
                      disabled={requesting}
                      className="h-11 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-brand-900"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              {requestMessage && (
                <p
                  role="status"
                  className="mt-2 text-sm font-semibold text-[var(--color-success-fg)]"
                >
                  {requestMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
