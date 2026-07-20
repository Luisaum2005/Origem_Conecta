import { SUPPLIER_PRODUCT_GROUPS } from "@/lib/hortifruti";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

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
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return SUPPLIER_PRODUCT_GROUPS;
    return SUPPLIER_PRODUCT_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.toLowerCase().includes(normalizedQuery)),
    })).filter((group) => group.items.length);
  }, [query]);

  const toggle = (product: string) =>
    onChange(
      value.includes(product) ? value.filter((item) => item !== product) : [...value, product],
    );

  return (
    <div>
      <span className="block text-sm font-medium text-brand-900">
        O que você produz ou fornece?
        {required && <span className="ml-1 text-orange-600">*</span>}
      </span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-left text-sm text-brand-900 hover:border-leaf-500"
      >
        <span className="truncate text-muted-foreground">
          {value.length === 0
            ? "Selecione os produtos que você fornece"
            : `${value.length} produto${value.length > 1 ? "s" : ""} selecionado${value.length > 1 ? "s" : ""}`}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
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
                className="hover:text-orange-600"
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
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto"
              className="h-9 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-2">
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
                    return (
                      <li key={product}>
                        <button
                          type="button"
                          onClick={() => toggle(product)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
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
