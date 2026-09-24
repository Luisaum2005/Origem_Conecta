const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata valores em reais no padrão brasileiro (R$ 2.128,50). */
export function formatBRL(value: number) {
  return BRL.format(Number.isFinite(value) ? value : 0);
}
