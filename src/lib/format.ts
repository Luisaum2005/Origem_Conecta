const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata valores em reais no padrão brasileiro (R$ 2.128,50). */
export function formatBRL(value: number) {
  return BRL.format(Number.isFinite(value) ? value : 0);
}

const NAME_CONNECTORS = new Set(["de", "da", "das", "do", "dos", "e"]);

/** Iniciais para avatar ("Sítio das Laranjas" → "SL"), ignorando preposições. */
export function initials(name?: string) {
  return (name ?? "")
    .split(/\s+/)
    .filter((word) => word && !NAME_CONNECTORS.has(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

const INVARIABLE_UNITS = new Set(["kg", "g", "l", "ml", "t", "un", "cx", "und", "dz"]);

/** Unidade no plural quando a quantidade pede ("maço" → "320 maços"; "kg" não muda). */
export function unitLabel(unit: string, quantity: number) {
  const clean = unit.trim();
  if (Math.abs(quantity) === 1 || INVARIABLE_UNITS.has(clean.toLowerCase())) return clean;
  if (/[aeiouáéíóú]$/i.test(clean)) return `${clean}s`;
  if (/[rz]$/i.test(clean)) return `${clean}es`;
  return clean;
}

/** "R$ 2,1 mil" para KPIs; abaixo de mil mostra o valor inteiro em reais. */
export function formatCompactBRL(value: number) {
  if (Math.abs(value) >= 1_000_000)
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  if (Math.abs(value) >= 1_000)
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** "hoje, 07:11" · "ontem" · "22/09" (cards de pedido); com `weekdays`, "ter." na semana. */
export function relativeDay(value: string | Date, withTime = true, weekdays = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 864e5);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return withTime ? `hoje, ${time}` : "hoje";
  if (diff === 1) return "ontem";
  if (weekdays && diff > 1 && diff < 7)
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const PAYMENT_PREFERENCE_KEY = "origem-conecta-payment-preference";

/** Forma de pagamento preferida do comprador (guardada no aparelho, sugerida nas listas). */
export function readPaymentPreference(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PAYMENT_PREFERENCE_KEY);
}

export function writePaymentPreference(value: string) {
  window.localStorage.setItem(PAYMENT_PREFERENCE_KEY, value);
}

/** Quantidade no padrão brasileiro, até 2 casas ("40", "12,5"). */
export function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
