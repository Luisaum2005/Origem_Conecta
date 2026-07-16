import { afterEach, describe, expect, it, vi } from "vitest";
import { canCancelOrder, type SavedOrder } from "./orders";

function makeOrder(overrides: Partial<SavedOrder> = {}): SavedOrder {
  return {
    id: "order-1",
    createdAt: "2026-07-16T12:00:00.000Z",
    buyerName: "Comprador",
    status: "Recebido",
    subtotal: 100,
    delivery: 0,
    total: 100,
    items: [],
    deliveryEta: "A combinar",
    cancellationDeadline: "2026-07-16T14:00:00.000Z",
    ...overrides,
  };
}

describe("canCancelOrder", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite cancelar antes do prazo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T13:59:59.000Z"));

    expect(canCancelOrder(makeOrder())).toBe(true);
  });

  it("impede cancelar depois do prazo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T14:00:01.000Z"));

    expect(canCancelOrder(makeOrder())).toBe(false);
  });

  it.each(["Entregue", "Cancelado"] as const)("impede cancelar pedido %s", (status) => {
    expect(canCancelOrder(makeOrder({ status }))).toBe(false);
  });

  it("calcula o prazo padrao de duas horas para pedidos antigos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T14:00:01.000Z"));

    expect(canCancelOrder(makeOrder({ cancellationDeadline: undefined }))).toBe(false);
  });
});
