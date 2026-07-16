import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { SupportButton } from "@/components/layout/SupportButton";
import { useAvailableProducts } from "@/lib/available-products";
import { useBuyerProfileDetails } from "@/lib/buyer-profile";
import { useCart } from "@/lib/cart";
import { preferredProducer } from "@/lib/catalog";
import { getOperationWindow } from "@/lib/operation";
import { PAYMENT_METHODS, type PaymentMethod, useOrders } from "@/lib/orders";
import { useProducerStock } from "@/lib/producer-stock";
import { useRecurringOrders } from "@/lib/recurring-orders";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  ClipboardCopy,
  Minus,
  Plus,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/order")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Order />
    </RequireProfile>
  ),
});

type RemovedItem = {
  productId: string;
  quantity: number;
  producerChoice?: string;
  name: string;
};

const maturityOptions = [
  "Sem preferência",
  "Mais verde para durar mais",
  "No ponto para uso imediato",
  "Mais maduro",
];

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function parseQuantity(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampQuantity(value: number, max: number) {
  return Math.max(0, Math.min(max, Number(value.toFixed(2))));
}

function Order() {
  const products = useAvailableProducts();
  const operation = getOperationWindow();
  const { cart, producerChoices, selectedUnits, setQty, setProducerChoice, setUnit, clear } =
    useCart();
  const { details: buyerDetails } = useBuyerProfileDetails();
  const { addOrder } = useOrders();
  const [, , { decrementStock }] = useProducerStock();
  const { addRecurringOrder } = useRecurringOrders();
  const navigate = useNavigate();
  const [repeatNotice, setRepeatNotice] = useState("");
  const [recurringNotice, setRecurringNotice] = useState("");
  const [removedItem, setRemovedItem] = useState<RemovedItem | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [maturityPreference, setMaturityPreference] = useState(maturityOptions[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Pix");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
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
      unit: selectedUnits[product.id] ?? product.unit,
      unitPrice: selectedProducer.price,
      producerId: selectedProducer.id,
      producerName: selectedProducer.name,
      manualProducerChoice: Boolean(producerChoices[product.id]),
      lineTotal: selectedProducer.price * quantity,
      notes: `Maturação: ${maturityPreference}`,
    };
  });

  const summaryText = useMemo(() => {
    if (!orderItems.length) return "";
    const lines = [
      "Resumo do pedido - Origem Conecta",
      `Comprador: ${buyerDetails.companyName || buyerDetails.responsibleName || "Comprador"}`,
      `Pedido até: ${operation.cutoffLabel}`,
      `Entrega prevista: ${operation.deliveryLabel}`,
      `Pagamento: ${paymentMethod}`,
      paymentNotes.trim() ? `Observacao do pagamento: ${paymentNotes.trim()}` : "",
      `Maturação: ${maturityPreference}`,
      "",
      ...orderItems.flatMap((item) => [
        `- ${item.productName}`,
        `  Quantidade: ${formatQuantity(item.quantity)} ${item.unit}`,
        `  Produtor: ${item.producerName}`,
        `  Total: R$ ${item.lineTotal.toFixed(2)}`,
      ]),
      "",
      `Subtotal: R$ ${subtotal.toFixed(2)}`,
      `Logística: R$ ${delivery.toFixed(2)}`,
      `Total: R$ ${total.toFixed(2)}`,
    ];
    return lines.join("\n");
  }, [
    buyerDetails.companyName,
    buyerDetails.responsibleName,
    delivery,
    maturityPreference,
    operation.cutoffLabel,
    operation.deliveryLabel,
    orderItems,
    paymentMethod,
    paymentNotes,
    subtotal,
    total,
  ]);

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

  const removeProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    setRemovedItem({
      productId,
      quantity: cart[productId],
      producerChoice: producerChoices[productId],
      name: product?.name ?? "Produto",
    });
    setQty(productId, 0);
  };

  const restoreRemovedItem = () => {
    if (!removedItem) return;
    setQty(removedItem.productId, removedItem.quantity);
    if (removedItem.producerChoice) {
      setProducerChoice(removedItem.productId, removedItem.producerChoice);
    }
    setRemovedItem(null);
  };

  const updateQuantity = (productId: string, value: number, max: number) => {
    setQty(productId, clampQuantity(value, max));
  };

  const copySummary = async () => {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyNotice("Resumo copiado.");
    } catch {
      setCopyNotice("Não foi possível copiar automaticamente. Selecione o resumo manualmente.");
    }
  };

  const handleConfirmOrder = async () => {
    if (isConfirming || hasStockIssues) return;
    setIsConfirming(true);
    setConfirmError("");
    try {
      const savedOrder = await addOrder({
        buyerName: buyerDetails.companyName || buyerDetails.responsibleName || "Comprador",
        subtotal,
        delivery,
        total,
        deliveryEta: operation.deliveryLabel,
        paymentMethod,
        paymentNotes: paymentNotes.trim() || undefined,
        items: orderItems,
      });
      await decrementStock(
        orderItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
      clear();
      window.sessionStorage.setItem(
        "origem-conecta-order-success",
        `Compra enviada com sucesso. Pedido #${savedOrder.id} com ${operation.deliveryText.toLowerCase()}`,
      );
      navigate({ to: "/orders" });
    } catch (error) {
      setConfirmError(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o pedido. Tente novamente.",
      );
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/portfolio"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao portfólio
          </Link>
          <SupportButton compact />
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
          Revisão do pedido
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Altere quantidades, acrescente itens, confira produtores e copie o resumo antes de
          confirmar.
        </p>

        <div className="mt-4 rounded-xl border border-[var(--border-strong)] bg-surface-brand-soft px-4 py-3 text-sm text-brand-900">
          <strong>{operation.orderDeadlineText}</strong> {operation.deliveryText}
        </div>

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

        {removedItem && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
            <span>{removedItem.name} foi removido do pedido.</span>
            <button type="button" onClick={restoreRemovedItem} className="font-bold underline">
              Desfazer
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-white p-8 text-center sm:p-12">
            <ShoppingBag className="mx-auto h-10 w-10 text-leaf-700" />
            <h3 className="mt-4 text-lg font-semibold text-brand-900">Seu pedido está vazio</h3>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-brand-900">Itens do pedido</h2>
                <Link
                  to="/portfolio"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
                >
                  Acrescentar itens
                </Link>
              </div>

              {items.map((product) => {
                const selectedProducer =
                  product.producers.find((item) => item.id === producerChoices[product.id]) ??
                  preferredProducer(product);
                const lineTotal = selectedProducer.price * cart[product.id];
                const currentUnit = selectedUnits[product.id] ?? product.unit;
                return (
                  <div
                    key={product.id}
                    className="rounded-2xl border border-border bg-white p-4 shadow-xs transition-shadow hover:shadow-sm sm:p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface-brand-soft text-3xl sm:h-20 sm:w-20 sm:text-4xl">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full rounded-xl object-cover"
                          />
                        ) : (
                          product.emoji
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-brand-900 sm:text-lg">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          Produtor: {selectedProducer.name}
                        </p>
                        {selectedProducer.origin && (
                          <p className="text-xs text-muted-foreground">{selectedProducer.origin}</p>
                        )}
                        <p className="mt-1.5 text-sm font-medium text-brand-700">
                          Unidade: {currentUnit} · R$ {selectedProducer.price.toFixed(2)}/
                          {currentUnit}
                        </p>
                      </div>
                      <button
                        onClick={() => removeProduct(product.id)}
                        className="hidden h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error-fg)] sm:grid cursor-pointer"
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
                            updateQuantity(product.id, cart[product.id], nextProducer.stock);
                          }}
                          className="mt-2 h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
                        >
                          <option value="">Automática recomendada pela Origem</option>
                          {product.producers.map((producer) => (
                            <option key={producer.id} value={producer.id}>
                              {producer.name} · R$ {producer.price.toFixed(2)} ·{" "}
                              {formatQuantity(producer.stock)} {product.unit}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex flex-wrap items-end justify-between gap-3 sm:justify-end">
                        {cart[product.id] > selectedProducer.stock && (
                          <p className="text-xs font-semibold text-[var(--color-error-fg)]">
                            Estoque: {formatQuantity(selectedProducer.stock)} {currentUnit}
                          </p>
                        )}

                        <OrderItemControls
                          productId={product.id}
                          quantity={cart[product.id]}
                          unit={currentUnit}
                          maxStock={selectedProducer.stock}
                          onQuantityChange={(qty) =>
                            updateQuantity(product.id, qty, selectedProducer.stock)
                          }
                          onUnitChange={(unit) => setUnit(product.id, unit)}
                        />

                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-error-bg)] bg-white px-3 text-sm font-semibold text-[var(--color-error-fg)] hover:bg-[var(--color-error-bg)] sm:hidden cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>

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
                <h2 className="text-lg font-semibold text-brand-900">Resumo da compra</h2>
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

                <div className="mt-5 rounded-xl border border-border bg-canvas p-4">
                  <p className="text-sm font-semibold text-brand-900">Maturação do produto</p>
                  <div className="mt-3 space-y-2">
                    {maturityOptions.map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 text-sm text-brand-900"
                      >
                        <input
                          type="radio"
                          name="maturity"
                          value={option}
                          checked={maturityPreference === option}
                          onChange={() => setMaturityPreference(option)}
                          className="h-4 w-4 accent-[var(--color-brand-900)]"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-canvas p-4">
                  <p className="text-sm font-semibold text-brand-900">Forma de pagamento</p>
                  <label className="mt-3 block">
                    <span className="sr-only">Forma de pagamento</span>
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                      className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 focus:border-leaf-600 focus:outline-none"
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Observação sobre pagamento
                    </span>
                    <textarea
                      value={paymentNotes}
                      onChange={(event) => setPaymentNotes(event.target.value)}
                      rows={3}
                      placeholder="Ex: chave Pix, faturar para 30 dias, pagar na entrega..."
                      className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-brand-900">Resumo para conferência</p>
                    <button
                      type="button"
                      onClick={() => void copySummary()}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-brand-900 hover:border-leaf-500 sm:w-auto"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                      Copiar
                    </button>
                  </div>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-canvas p-3 text-xs leading-relaxed text-brand-900">
                    {summaryText}
                  </pre>
                  {copyNotice && (
                    <p className="mt-2 text-xs font-semibold text-leaf-700">{copyNotice}</p>
                  )}
                </div>

                {hasStockIssues && (
                  <div className="mt-4 rounded-xl border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-error-fg)]">
                    Ajuste as quantidades. Um ou mais itens ultrapassam o estoque publicado.
                  </div>
                )}
                {confirmError && (
                  <div className="mt-4 rounded-xl border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-error-fg)]">
                    {confirmError}
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
                      preferredDeliveryDay: operation.shortDeliveryLabel,
                      items: orderItems,
                    });
                    setRecurringNotice(
                      "Pedido recorrente salvo. Você pode carregar esse modelo em Meus pedidos antes de confirmar uma nova compra.",
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
                    <Calendar className="h-3.5 w-3.5 text-leaf-700" /> Fechamento:{" "}
                    {operation.cutoffLabel}
                  </li>
                  <li className="inline-flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-leaf-700" /> Entrega prevista:{" "}
                    {operation.deliveryLabel}
                  </li>
                  <li className="inline-flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf-700" />
                    <span>{operation.issueText}</span>
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

function OrderItemControls({
  productId,
  quantity,
  unit,
  maxStock,
  onQuantityChange,
  onUnitChange,
}: {
  productId: string;
  quantity: number;
  unit: string;
  maxStock: number;
  onQuantityChange: (qty: number) => void;
  onUnitChange: (unit: string) => void;
}) {
  const [inputValue, setInputValue] = useState(
    quantity > 0 ? quantity.toString().replace(".", ",") : "",
  );

  useEffect(() => {
    setInputValue(quantity > 0 ? quantity.toString().replace(".", ",") : "");
  }, [quantity]);

  const handleInputChange = (valueStr: string) => {
    setInputValue(valueStr);
    const parsed = Number(valueStr.replace(",", "."));
    if (Number.isFinite(parsed)) {
      onQuantityChange(parsed);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 w-28">
        <input
          type="text"
          value={inputValue}
          onChange={(event) => handleInputChange(event.target.value)}
          placeholder="Qtd"
          inputMode="decimal"
          className="h-11 w-full rounded-xl border border-border bg-white px-3 text-center text-sm font-semibold text-brand-900 focus:border-leaf-600 focus:outline-none"
        />
      </div>
      <select
        value={unit}
        onChange={(event) => onUnitChange(event.target.value)}
        className="h-11 w-24 rounded-xl border border-border bg-white px-2 text-center text-sm font-semibold text-brand-900 focus:border-leaf-600 focus:outline-none"
      >
        <option value="kg">kg</option>
        <option value="caixa">caixa</option>
        <option value="unidade">unid</option>
        <option value="cacho">cacho</option>
        <option value="pote">pote</option>
        <option value="pacote">pacote</option>
        <option value="saco">saco</option>
      </select>
    </div>
  );
}
