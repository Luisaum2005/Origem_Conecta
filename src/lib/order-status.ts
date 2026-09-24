import type { OrderStatus, SavedOrder } from "@/lib/orders";

/** Classe do chip de status (cores do Figma: neutro, laranja, azul, verde, vermelho). */
export const STATUS_CHIP: Record<OrderStatus, string> = {
  Recebido: "m-st-recebido",
  "Em separação": "m-st-separacao",
  "Em entrega": "m-st-entrega",
  Entregue: "m-st-entregue",
  Cancelado: "m-st-cancelado",
};

/** Progresso da barra no card de solicitação. */
export const STATUS_PROGRESS: Record<OrderStatus, number> = {
  Recebido: 15,
  "Em separação": 45,
  "Em entrega": 75,
  Entregue: 100,
  Cancelado: 0,
};

/** "Alface, tomate" a partir dos itens do pedido ("Mandioca, abóbora cabotiá" com `full`). */
export function orderItemsLabel(order: SavedOrder, full = false) {
  if (order.items.length === 1) return order.items[0].productName;
  const names = order.items.map((item, index) => {
    const name = full ? item.productName : item.productName.split(" ")[0];
    return index === 0 ? name : name.toLowerCase();
  });
  return [...new Set(names)].join(", ");
}

export function orderProducersLabel(order: SavedOrder) {
  const producers = [...new Set(order.items.map((item) => item.producerName))];
  return producers.length === 1 ? producers[0] : `${producers.length} produtores`;
}

/** Horário previsto de chegada para pedidos em entrega ("Chega hoje até 10h"). */
export function arrivalLabel(order: SavedOrder) {
  if (!order.deliveryAt) return `Chega ${order.deliveryEta.toLowerCase()}`;
  const date = new Date(order.deliveryAt);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getTime() + 864e5).toDateString() === date.toDateString();
  const day = sameDay
    ? "hoje"
    : tomorrow
      ? "amanhã"
      : date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const match = order.deliveryEta.match(/(\d{1,2})h\s*$/);
  const hour = match ? `${match[1]}h` : `${date.getHours()}h`;
  return `Chega ${day} até ${hour}`;
}
