import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAvailableProducts } from "@/lib/available-products";
import { useCart } from "@/lib/cart";
import { preferredProducer } from "@/lib/catalog";
import { useOrders } from "@/lib/orders";
import { useProducerStock } from "@/lib/producer-stock";
import { useRecurringOrders } from "@/lib/recurring-orders";
import { Minus, Plus, Trash2, ArrowLeft, ShieldCheck, Truck, Calendar, Repeat } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/order")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Order />
    </RequireProfile>
  ),
});

function Order() {
  const products = useAvailableProducts();
  const { cart, producerChoices, setQty, setProducerChoice, clear } = useCart();
  const { addOrder } = useOrders();
  const [, , { decrementStock }] = useProducerStock();
  const { addRecurringOrder } = useRecurringOrders();
  const navigate = useNavigate();
  const [repeatNotice, setRepeatNotice] = useState("");
  const [recurringNotice, setRecurringNotice] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const items = products.filter((product) => cart[product.id]);
  const subtotal = items.reduce((sum, product) => {
    const producer =
      product.producers.find((item) => item.id === producerChoices[product.id]) ??
      preferredProducer(product);
    return sum + producer.price * cart[product.id];
  }, 0);
  const delivery = items.length ? 35 : 0;
  const total = subtotal + delivery;
  const orderItems = items.map((product) => {
    const selectedProducer =
      product.producers.find((item) => item.id === producerChoices[product.id]) ??
      preferredProducer(product);
    const quantity = cart[product.id];
    return {
      productId: product.id,
      productName: product.name,
      quantity,
      unit: product.unit,
      unitPrice: selectedProducer.price,
      producerId: selectedProducer.id,
      producerName: selectedProducer.name,
      manualProducerChoice: Boolean(producerChoices[product.id]),
      lineTotal: selectedProducer.price * quantity,
    };
  });
  const stockIssues = items
    .map((product) => {
      const selectedProducer =
        product.producers.find((item) => item.id === producerChoices[product.id]) ??
        preferredProducer(product);
      const requested = cart[product.id] ?? 0;
      return requested > selectedProducer.stock
        ? {
            productId: product.id,
            productName: product.name,
            requested,
            available: selectedProducer.stock,
            unit: product.unit,
          }
        : null;
    })
    .filter(Boolean);
  const hasStockIssues = stockIssues.length > 0;

  const handleConfirmOrder = async () => {
    if (isConfirming || hasStockIssues) return;
    setIsConfirming(true);
    try {
      addOrder({
        buyerName: "Cozinha Atelier",
        subtotal,
        delivery,
        total,
        deliveryEta: "Proximo ciclo",
        items: orderItems,
      });
      await decrementStock(
        orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
      clear();
      navigate({ to: "/orders" });
    } finally {
      setIsConfirming(false);
    }
  };

  useEffect(() => {
    const notice = window.sessionStorage.getItem("origem-conecta-repeat-notice");
    if (!notice) return;
    setRepeatNotice(notice);
    window.sessionStorage.removeItem("origem-conecta-repeat-notice");
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-6 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <Link
          to="/portfolio"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-brand-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao portfólio
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
          Revisão do pedido
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Confira itens, produtores e detalhes da entrega.
        </p>

        {repeatNotice && (
          <div className="mt-4 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm font-medium text-brand-900">
            {repeatNotice}
          </div>
        )}

        {recurringNotice && (
          <div className="mt-4 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm font-medium text-brand-900">
            {recurringNotice}
          </div>
        )}

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-white p-12 text-center">
            <h3 className="text-lg font-semibold text-brand-900">Seu pedido está vazio</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione produtos do portfólio da semana para continuar.
            </p>
            <Link
              to="/portfolio"
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Ver portfólio
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
            <section className="space-y-3">
              {items.map((product) => {
                const selectedProducer =
                  product.producers.find((item) => item.id === producerChoices[product.id]) ??
                  preferredProducer(product);
                const lineTotal = selectedProducer.price * cart[product.id];
                return (
                  <div
                    key={product.id}
                    className="rounded-2xl border border-border bg-white p-4 shadow-xs transition-shadow hover:shadow-sm sm:p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface-brand-soft text-3xl sm:h-20 sm:w-20 sm:text-4xl">
                        {product.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-brand-900 sm:text-lg">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {selectedProducer.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedProducer.origin} · {selectedProducer.onTimeRate}% no prazo
                        </p>
                        <p className="mt-1.5 text-sm font-medium text-brand-700">
                          R$ {selectedProducer.price.toFixed(2)}/{product.unit}
                        </p>
                      </div>
                      <button
                        onClick={() => setQty(product.id, 0)}
                        className="hidden h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error-fg)] sm:grid"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto]">
                      <label className="block">
                        <span className="text-xs font-semibold text-brand-900">
                          Escolha do produtor
                        </span>
                        <select
                          value={producerChoices[product.id] ?? ""}
                          onChange={(event) => {
                            const producerId = event.target.value;
                            const nextProducer =
                              product.producers.find((producer) => producer.id === producerId) ??
                              preferredProducer(product);
                            setProducerChoice(product.id, producerId);
                            setQty(product.id, Math.min(cart[product.id], nextProducer.stock));
                          }}
                          className="mt-2 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
                        >
                          <option value="">Automática recomendada pela Origem</option>
                          {product.producers.map((producer) => (
                            <option key={producer.id} value={producer.id}>
                              {producer.name} · R$ {producer.price.toFixed(2)} · {producer.stock}{" "}
                              {product.unit}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex items-end justify-between gap-3 sm:justify-end">
                        {cart[product.id] > selectedProducer.stock && (
                          <p className="text-xs font-semibold text-[var(--color-error-fg)]">
                            Estoque: {selectedProducer.stock} {product.unit}
                          </p>
                        )}
                        <div className="inline-flex h-11 items-center rounded-xl border border-border bg-white">
                          <button
                            onClick={() => setQty(product.id, cart[product.id] - 1)}
                            className="grid h-11 w-11 place-items-center rounded-l-xl text-brand-900 transition-colors hover:bg-secondary active:scale-95"
                            aria-label="Diminuir"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-10 text-center text-sm font-semibold tabular-nums">
                            {cart[product.id]}
                          </span>
                          <button
                            onClick={() =>
                              setQty(
                                product.id,
                                Math.min(selectedProducer.stock, cart[product.id] + 1),
                              )
                            }
                            disabled={cart[product.id] >= selectedProducer.stock}
                            className="grid h-11 w-11 place-items-center rounded-r-xl text-brand-900 transition-colors hover:bg-secondary active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Total
                          </p>
                          <p className="text-base font-bold tabular-nums text-brand-900 sm:text-lg">
                            R$ {lineTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <aside className="space-y-4 lg:sticky lg:top-[88px] lg:h-fit">
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-brand-900">Resumo</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-medium tabular-nums text-brand-900">
                      R$ {subtotal.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Logística</dt>
                    <dd className="font-medium tabular-nums text-brand-900">
                      R$ {delivery.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3 text-base">
                    <dt className="font-semibold text-brand-900">Total</dt>
                    <dd className="text-xl font-bold tabular-nums text-brand-900">
                      R$ {total.toFixed(2)}
                    </dd>
                  </div>
                </dl>
                {hasStockIssues && (
                  <div className="mt-4 rounded-xl border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-error-fg)]">
                    Ajuste as quantidades. Um ou mais itens ultrapassam o estoque publicado.
                  </div>
                )}
                <button
                  disabled={isConfirming || hasStockIssues}
                  onClick={handleConfirmOrder}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConfirming ? "Confirmando..." : "Confirmar pedido"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addRecurringOrder({
                      name: `Cesta recorrente - ${new Date().toLocaleDateString("pt-BR")}`,
                      frequency: "semanal",
                      preferredDeliveryDay: "proximo ciclo",
                      items: orderItems,
                    });
                    setRecurringNotice(
                      "Pedido salvo como recorrente. Voce pode carregar esse modelo em Meus pedidos.",
                    );
                  }}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 text-sm font-semibold text-brand-900 hover:border-leaf-500"
                >
                  <Repeat className="h-4 w-4" />
                  Salvar como recorrente
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--border-strong)] bg-surface-brand-soft p-5">
                <h3 className="inline-flex items-center gap-2 font-semibold text-brand-900">
                  <ShieldCheck className="h-4 w-4 text-leaf-700" />
                  Distribuição inteligente
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Você pode deixar a Origem escolher automaticamente ou travar produtores
                  específicos por item.
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-brand-900">
                  <li className="inline-flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-leaf-700" /> Fechamento: próxima segunda,
                    18h
                  </li>
                  <li className="inline-flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-leaf-700" /> Entrega prevista: próximo ciclo
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
