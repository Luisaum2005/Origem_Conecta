const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function nextMondayAt18(from = new Date()) {
  const date = new Date(from);
  const day = date.getDay();
  let daysUntilMonday = (1 - day + 7) % 7;

  if (daysUntilMonday === 0 && date.getHours() >= 18) {
    daysUntilMonday = 7;
  }

  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(18, 0, 0, 0);
  return date;
}

function nextBusinessDayAfter(date: Date) {
  const deliveryDate = new Date(date);
  deliveryDate.setDate(deliveryDate.getDate() + 1);
  deliveryDate.setHours(8, 0, 0, 0);

  while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
  }

  return deliveryDate;
}

export function getOperationWindow() {
  const cutoff = nextMondayAt18();
  const delivery = nextBusinessDayAfter(cutoff);
  const cutoffDate = WEEKDAY_FORMATTER.format(cutoff);
  const deliveryDate = WEEKDAY_FORMATTER.format(delivery);

  return {
    cutoff,
    delivery,
    cutoffLabel: `${cutoffDate} até 18h`,
    deliveryLabel: `${deliveryDate}, a partir das 8h`,
    shortDeliveryLabel: deliveryDate,
    orderDeadlineText: `Faça o pedido até ${cutoffDate}, 18h.`,
    deliveryText: `Entrega prevista em ${deliveryDate}, a partir das 8h.`,
    issueText:
      "Se o produto não chegar no prazo, acione o suporte para registrarmos o problema e acompanharmos a solução.",
  };
}
