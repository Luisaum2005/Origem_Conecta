import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  Ellipsis,
  Info,
  MapPin,
  Minus,
  Plus,
  Repeat,
  Send,
  ShoppingBasket,
  Wallet,
} from "@/components/mobile/icons";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ProductFallback } from "@/components/marketplace/ProductCard";
import { formatQuantity } from "@/lib/format";
import { MoreMenu, Sheet } from "@/components/mobile/Sheet";
import { useAvailableProducts } from "@/lib/available-products";
import { useBuyerProfileDetails } from "@/lib/buyer-profile";
import { useCart } from "@/lib/cart";
import { preferredProducer } from "@/lib/catalog";
import { formatBRL, readPaymentPreference, unitLabel } from "@/lib/format";
import { getOperationWindow } from "@/lib/operation";
import { PAYMENT_METHODS, type PaymentMethod, useOrders } from "@/lib/orders";
import { useRecurringOrders } from "@/lib/recurring-orders";

export const Route = createFileRoute("/order")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Order />
    </RequireProfile>
  ),
});

const maturityOptions = [
  "Sem preferência",
  "Mais verde para durar mais",
  "No ponto para uso imediato",
  "Mais maduro",
];

function clampQuantity(value: number, max: number) {
  return Math.max(0, Math.min(max, Number(value.toFixed(2))));
}

function hasCompleteDeliveryAddress(details: {
  postalCode: string;
  addressLine: string;
  neighborhood: string;
  city: string;
  state: string;
}) {
  return (
    details.postalCode.replace(/\D/g, "").length === 8 &&
    Boolean(details.addressLine.trim()) &&
    Boolean(details.neighborhood.trim()) &&
    Boolean(details.city.trim()) &&
    /^[A-Za-z]{2}$/.test(details.state.trim())
  );
}

function Order() {
  const products = useAvailableProducts();
  const operation = useMemo(() => getOperationWindow(), []);
  const { cart, setQty, clear } = useCart();
  const { details: buyerDetails } = useBuyerProfileDetails();
  const { addOrder } = useOrders();
  const { addRecurringOrder } = useRecurringOrders();
  const navigate = useNavigate();
  const router = useRouter();
  const [confirmError, setConfirmError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [maturityPreference, setMaturityPreference] = useState(maturityOptions[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    const preferred = readPaymentPreference();
    return PAYMENT_METHODS.includes(preferred as PaymentMethod)
      ? (preferred as PaymentMethod)
      : "A combinar";
  });
  const [prefsOpen, setPrefsOpen] = useState(false);
  const orderRequestIdRef = useRef<string | null>(null);
  const items = products.filter((product) => cart[product.id]);

  const subtotal = items.reduce(
    (sum, product) => sum + preferredProducer(product).price * cart[product.id],
    0,
  );
  const orderItems = items.map((product) => {
    const producer = preferredProducer(product);
    const quantity = cart[product.id];
    return {
      productId: product.id,
      productName: product.name,
      quantity,
      unit: product.unit,
      unitPrice: producer.price,
      producerId: producer.id,
      producerName: producer.name,
      sellerOrganizationId: producer.sellerOrganizationId,
      sellerOrganizationName: producer.sellerOrganizationName,
      sellerOrganizationCnpj: producer.sellerOrganizationCnpj,
      manualProducerChoice: false,
      lineTotal: producer.price * quantity,
      notes: `Maturação: ${maturityPreference}`,
    };
  });

  const summaryText = [
    "Solicitação de negociação - Origem Conecta",
    `Comprador: ${buyerDetails.companyName || buyerDetails.responsibleName || "Comprador"}`,
    `Solicitação enviada até: ${operation.cutoffLabel}`,
    `Preferência de entrega: ${operation.deliveryLabel}`,
    `Maturação: ${maturityPreference}`,
    `Forma de pagamento sugerida: ${paymentMethod}`,
    "",
    ...orderItems.flatMap((item) => [
      `- ${item.productName}`,
      `  Quantidade: ${formatQuantity(item.quantity)} ${item.unit}`,
      `  Produtor: ${item.producerName}`,
      `  Valor anunciado: ${formatBRL(item.lineTotal)}`,
    ]),
    "",
    `Valor estimado: ${formatBRL(subtotal)}`,
    "Preço, logística, pagamento e documentação serão definidos na negociação.",
  ].join("\n");

  const hasStockIssues = items.some(
    (product) => (cart[product.id] ?? 0) > preferredProducer(product).stock,
  );
  const addressReady = hasCompleteDeliveryAddress(buyerDetails);
  const address = [
    [buyerDetails.addressLine, buyerDetails.addressNumber].filter(Boolean).join(", "),
    buyerDetails.neighborhood,
    `${buyerDetails.city}/${buyerDetails.state.toUpperCase()}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const cutoff = operation.cutoff;
  const cutoffText = `${cutoff.toLocaleDateString("pt-BR", { weekday: "short" })} ${cutoff.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, 18h`;
  const deliveryText = `${operation.delivery.toLocaleDateString("pt-BR", { weekday: "short" })}, 8h`;

  const changeQuantity = (productId: string, name: string, next: number, max: number) => {
    const previous = cart[productId] ?? 0;
    const value = clampQuantity(next, max);
    setQty(productId, value);
    if (value === 0) {
      toast.success(
        <span>
          <b>{name}</b> saiu da lista
        </span>,
        { action: { label: "Desfazer", onClick: () => setQty(productId, previous) } },
      );
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast.success("Resumo copiado");
    } catch {
      toast.error("Não foi possível copiar o resumo.");
    }
  };

  const saveRecurring = () => {
    addRecurringOrder({
      name: `Cesta recorrente - ${new Date().toLocaleDateString("pt-BR")}`,
      frequency: "semanal",
      preferredDeliveryDay: operation.shortDeliveryLabel,
      items: orderItems,
    });
    toast.success("Lista salva como pedido recorrente");
  };

  const handleConfirmOrder = async () => {
    if (isConfirming || hasStockIssues) return;
    if (!addressReady) {
      void navigate({ to: "/profile/buyer", hash: "endereco" });
      return;
    }
    setIsConfirming(true);
    setConfirmError("");
    try {
      orderRequestIdRef.current ??= crypto.randomUUID();
      const savedOrder = await addOrder(
        {
          buyerName: buyerDetails.companyName || buyerDetails.responsibleName || "Comprador",
          subtotal,
          delivery: 0,
          total: subtotal,
          deliveryEta: operation.deliveryLabel,
          paymentMethod,
          deliveryAddress: {
            postalCode: buyerDetails.postalCode.replace(/\D/g, ""),
            addressLine: buyerDetails.addressLine.trim(),
            addressNumber: buyerDetails.addressNumber.trim() || undefined,
            addressComplement: buyerDetails.addressComplement.trim() || undefined,
            neighborhood: buyerDetails.neighborhood.trim() || undefined,
            city: buyerDetails.city.trim(),
            state: buyerDetails.state.trim().toUpperCase(),
          },
          items: orderItems,
        },
        orderRequestIdRef.current,
      );
      orderRequestIdRef.current = null;
      clear();
      window.sessionStorage.setItem(
        "origem-conecta-order-success",
        `Solicitação #${savedOrder.id} enviada. Aguarde o contato do produtor para negociar as condições.`,
      );
      void navigate({ to: "/orders" });
    } catch (error) {
      setConfirmError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a solicitação. Tente novamente.",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/portfolio" });
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-03-lista">
        <div className="m-status" />
        <div className="m-hd">
          <button type="button" className="m-round" onClick={goBack} aria-label="Voltar">
            <ArrowLeft className="lucide" aria-hidden />
          </button>
          <h1>Lista de interesse</h1>
          <MoreMenu
            label="Mais opções da lista"
            icon={<Ellipsis className="lucide" aria-hidden />}
            items={[
              {
                label: "Acrescentar itens",
                icon: <Plus className="lucide" aria-hidden />,
                onSelect: () => void navigate({ to: "/portfolio" }),
              },
              {
                label: "Copiar resumo",
                icon: <ClipboardCopy className="lucide" aria-hidden />,
                onSelect: () => void copySummary(),
              },
              {
                label: "Salvar como recorrente",
                icon: <Repeat className="lucide" aria-hidden />,
                onSelect: saveRecurring,
              },
            ]}
          />
        </div>

        <div className="m-banner">
          <Clock3 className="lucide" aria-hidden />
          <div>
            <b>Envie até {cutoffText}</b> · entrega {deliveryText}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>Sua lista está vazia</b>
              <span>Adicione produtos do portfólio da semana para continuar.</span>
              <Link to="/portfolio" className="m-btn m-secondary m-sm" style={{ marginTop: 16 }}>
                <ShoppingBasket className="lucide" aria-hidden />
                Ver portfólio
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="m-items">
              {items.map((product) => {
                const producer = preferredProducer(product);
                const quantity = cart[product.id];
                const over = quantity > producer.stock;
                return (
                  <div key={product.id} className="m-it m-card">
                    {product.imageUrl ? (
                      <div className="m-ph">
                        <img src={product.imageUrl} alt={product.name} />
                      </div>
                    ) : (
                      <ProductFallback
                        category={product.category}
                        name={product.name}
                        className="m-ph"
                        label={false}
                      />
                    )}
                    <div className="m-txt">
                      <b>{product.name}</b>
                      <span>{producer.property}</span>
                      <span className={over ? "m-over" : undefined}>
                        {over
                          ? `Estoque: ${formatQuantity(producer.stock)} ${unitLabel(product.unit, producer.stock)}`
                          : `${formatBRL(producer.price)}/${product.unit}`}
                      </span>
                      <div className="m-bt">
                        <div className="m-stepper">
                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(product.id, product.name, quantity - 1, producer.stock)
                            }
                            aria-label={`Diminuir ${product.name}`}
                          >
                            <Minus className="lucide" aria-hidden />
                          </button>
                          <QuantityInput
                            value={quantity}
                            label={`Quantidade de ${product.name}`}
                            onCommit={(value) =>
                              changeQuantity(product.id, product.name, value, producer.stock)
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(product.id, product.name, quantity + 1, producer.stock)
                            }
                            aria-label={`Aumentar ${product.name}`}
                          >
                            <Plus className="lucide" aria-hidden />
                          </button>
                        </div>
                        <b className="m-price">{formatBRL(producer.price * quantity)}</b>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="m-prefs m-card">
              <button type="button" onClick={() => setPrefsOpen(true)}>
                <Wallet className="lucide" aria-hidden />
                <div>
                  Pagamento e maturação
                  <span>
                    {paymentMethod} · {maturityPreference.toLowerCase()}
                  </span>
                </div>
                <ChevronRight className="lucide" aria-hidden />
              </button>
              <Link
                to="/profile/buyer"
                hash="endereco"
                className={addressReady ? undefined : "m-warn"}
              >
                <MapPin className="lucide" aria-hidden />
                <div>
                  Endereço de entrega
                  <span>{addressReady ? address : "Pendente — necessário para enviar"}</span>
                </div>
                <ChevronRight className="lucide" aria-hidden />
              </Link>
            </div>

            <div className="m-footer">
              <div className="m-sum">
                <span>
                  Estimado · {items.length} {items.length === 1 ? "item" : "itens"}
                </span>
                <b className="m-price">{formatBRL(subtotal)}</b>
              </div>
              <button
                type="button"
                className="m-btn m-primary"
                disabled={isConfirming || hasStockIssues}
                onClick={() => void handleConfirmOrder()}
              >
                {addressReady ? (
                  <Send className="lucide" aria-hidden />
                ) : (
                  <MapPin className="lucide" aria-hidden />
                )}
                {isConfirming
                  ? "Enviando..."
                  : addressReady
                    ? "Enviar solicitação"
                    : "Completar endereço e enviar"}
              </button>
              {(confirmError || hasStockIssues || !addressReady) && (
                <div className="m-reason" role={confirmError ? "alert" : undefined}>
                  <Info className="lucide" aria-hidden />
                  {confirmError ||
                    (hasStockIssues
                      ? "Ajuste as quantidades acima do estoque"
                      : "O envio libera depois do endereço")}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Sheet
        open={prefsOpen}
        title="Pagamento e maturação"
        onClose={() => setPrefsOpen(false)}
        footer={
          <button type="button" className="m-btn m-primary" onClick={() => setPrefsOpen(false)}>
            Pronto
          </button>
        }
      >
        <span className="m-lbl">Forma de pagamento</span>
        <div className="m-opts" role="radiogroup" aria-label="Forma de pagamento">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={paymentMethod === method}
              className={`m-pill${paymentMethod === method ? " m-sel" : ""}`}
              onClick={() => setPaymentMethod(method)}
            >
              {method}
            </button>
          ))}
        </div>
        <span className="m-lbl">Maturação do produto</span>
        <div className="m-opts" role="radiogroup" aria-label="Maturação do produto">
          {maturityOptions.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={maturityPreference === option}
              className={`m-pill${maturityPreference === option ? " m-sel" : ""}`}
              onClick={() => setMaturityPreference(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="m-note">
          Esta solicitação não confirma uma compra. Pagamento e maturação são preferências; os
          detalhes são combinados direto com o produtor.
        </p>
      </Sheet>
    </>
  );
}

function QuantityInput({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft.replace(",", "."));
    if (Number.isFinite(parsed)) onCommit(parsed);
    setDraft(null);
  };
  return (
    <input
      value={draft ?? formatQuantity(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
      inputMode="decimal"
      aria-label={label}
    />
  );
}
