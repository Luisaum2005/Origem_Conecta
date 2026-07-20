import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import {
  canCancelOrder,
  formatCancellationDeadline,
  formatOrderDate,
  getProducerId,
  type OrderStatus,
  type SavedOrder,
  useOrders,
} from "@/lib/orders";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  ShoppingBag,
  Sprout,
  Truck,
  Star,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { createBuyerRating, readLocalRatings } from "@/lib/ratings";

export const Route = createFileRoute("/producer/orders")({
  component: () => (
    <RequireProfile allowed={["produtor"]}>
      <ProducerOrders />
    </RequireProfile>
  ),
});

const PRODUCER_ID = "produtor";
const PRODUCER_NAME = "Produtor";

function ProducerOrders() {
  const { profile, isSupabaseConfigured } = useAuth();
  const { orders, updateStatus, confirmDelivery, cancelOrder, completeDelivery } = useOrders();
  const producerName = profile?.tipo === "produtor" ? profile.nome : PRODUCER_NAME;
  const producerOrders = getProducerOrders(
    orders,
    Boolean(isSupabaseConfigured && profile?.tipo === "produtor"),
    profile?.id,
  );

  const [ratedOrderIds, setRatedOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id || profile.tipo !== "produtor") return;
    const profileId = profile.id;
    let active = true;
    async function fetchRatedOrders() {
      try {
        const prodId = await getProducerId(profileId);
        if (!prodId) return;

        if (supabase && isSupabaseConfigured) {
          const { data, error } = await supabase
            .from("buyer_ratings")
            .select("order_id")
            .eq("producer_id", prodId);
          if (error) throw error;
          if (active && data) {
            setRatedOrderIds(new Set(data.map((r: { order_id: string }) => r.order_id)));
          }
        } else {
          const localRatings = readLocalRatings().filter((r) => r.producerId === prodId);
          if (active) {
            setRatedOrderIds(new Set(localRatings.map((r) => r.orderId)));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar avaliações feitas:", err);
      }
    }
    fetchRatedOrders();
    return () => {
      active = false;
    };
  }, [profile, isSupabaseConfigured]);

  const openOrders = producerOrders.filter(
    (order) => order.status !== "Entregue" && order.status !== "Cancelado",
  );
  const deliveredOrders = producerOrders.filter((order) => order.status === "Entregue");
  const totalRevenue = producerOrders.reduce((sum, order) => sum + producerOrderTotal(order), 0);
  const topProducts = productSummary(producerOrders);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Painel do produtor
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Negociações recebidas
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Acompanhe as solicitações de {producerName}, negocie as condições e avance o status
              operacional.
            </p>
          </div>
          <Link
            to="/production"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-800 sm:w-auto"
          >
            <Sprout className="h-4 w-4" />
            Gerenciar estoque
          </Link>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={ClipboardList}
            label="Solicitações recebidas"
            value={`${producerOrders.length}`}
          />
          <Metric icon={Truck} label="Em andamento" value={`${openOrders.length}`} />
          <Metric icon={PackageCheck} label="Entregues" value={`${deliveredOrders.length}`} />
          <Metric
            icon={ShoppingBag}
            label="Receita vinculada"
            value={`R$ ${totalRevenue.toFixed(2)}`}
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Fila operacional" icon={ClipboardList}>
            {producerOrders.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-4">
                {producerOrders.map((order) => (
                  <ProducerOrderCard
                    key={order.id}
                    order={order}
                    updateStatus={updateStatus}
                    confirmDelivery={confirmDelivery}
                    cancelOrder={cancelOrder}
                    completeDelivery={completeDelivery}
                    isRated={ratedOrderIds.has(order.id)}
                    onRate={(orderId) => {
                      setRatedOrderIds((prev) => {
                        const next = new Set(prev);
                        next.add(orderId);
                        return next;
                      });
                    }}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title="Produtos mais vendidos" icon={PackageCheck}>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Os produtos aparecem aqui quando houver solicitações para o produtor.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topProducts.map((product) => (
                    <li
                      key={product.name}
                      className="rounded-xl border border-border bg-canvas p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-brand-900">{product.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {product.quantity.toLocaleString("pt-BR")} {product.unit} vendidos
                          </p>
                        </div>
                        <p className="text-sm font-bold text-brand-900">
                          R$ {product.total.toFixed(2)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Próximas ações" icon={CheckCircle2}>
              <ul className="space-y-3">
                <ActionItem
                  title="Recebido"
                  text="Informe data e hora de entrega para confirmar."
                />
                <ActionItem title="Em separação" text="Prepare lote, embalagem e conferência." />
                <ActionItem title="Em entrega" text="Acompanhe a saída até a baixa do pedido." />
              </ul>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProducerOrderCard({
  order,
  updateStatus,
  confirmDelivery,
  cancelOrder,
  completeDelivery,
  isRated,
  onRate,
}: {
  order: SavedOrder;
  updateStatus: (id: string, status: OrderStatus) => Promise<void>;
  confirmDelivery: (id: string, deliveryAt: string) => Promise<void>;
  cancelOrder: (id: string, actor: "produtor", reason: string) => Promise<void>;
  completeDelivery: (id: string, code: string) => Promise<void>;
  isRated: boolean;
  onRate: (orderId: string) => void;
}) {
  const { profile } = useAuth();
  const total = producerOrderTotal(order);
  const [deliveryAt, setDeliveryAt] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const cancelAllowed = canCancelOrder(order);

  const confirmOrder = async () => {
    if (!deliveryAt) {
      setError("Informe a data e a hora da entrega antes de confirmar o pedido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await confirmDelivery(order.id, deliveryAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!cancelReason.trim()) {
      setError("O motivo do cancelamento é obrigatório.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await cancelOrder(order.id, "produtor", cancelReason);
      toast.success("Pedido cancelado com sucesso.");
      setIsCancelModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cancelar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  const submitRating = async () => {
    if (!order.buyerId) {
      setError("Identificação do comprador não encontrada neste pedido.");
      return;
    }

    setSubmittingRating(true);
    setError("");
    try {
      const prodId = await getProducerId(profile?.id || "");
      if (!prodId) {
        throw new Error("Cadastro de produtor não encontrado para este usuário.");
      }

      await createBuyerRating({
        orderId: order.id,
        buyerId: order.buyerId,
        producerId: prodId,
        rating: ratingValue,
        comment: ratingComment.trim() || undefined,
      });

      toast.success("Avaliação enviada com sucesso!");
      setIsRatingModalOpen(false);
      onRate(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a avaliação.");
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a avaliação.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const finishDelivery = async () => {
    if (!deliveryCode.trim()) {
      setError("Informe o código recebido do comprador para concluir a entrega.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await completeDelivery(order.id, deliveryCode);
      setDeliveryCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a entrega.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
            Solicitação #{order.id}
          </p>
          <h3 className="mt-1 text-lg font-bold text-brand-900 flex flex-wrap items-center gap-2">
            <span>
              {order.buyerName} - R$ {total.toFixed(2)}
            </span>
            <Link
              to="/chat"
              search={{ orderId: order.id, producerId: order.items[0]?.producerId }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-brand-900 hover:border-leaf-500 cursor-pointer"
            >
              <MessageSquare className="h-3 w-3 text-leaf-700" />
              Conversar
            </Link>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatOrderDate(order.createdAt)} - entrega {order.deliveryEta}
          </p>
          {order.status !== "Cancelado" && (
            <p className="mt-1 text-xs font-semibold text-orange-700">
              Cancelamento permitido até {formatCancellationDeadline(order)}
            </p>
          )}
          {order.status === "Cancelado" && (
            <div className="mt-4 rounded-xl border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error-fg)] space-y-1 w-full">
              <p className="font-bold text-base">Pedido Cancelado</p>
              <p>
                <strong>Responsável pelo cancelamento:</strong>{" "}
                {order.canceledBy === "comprador"
                  ? "Comprador"
                  : order.canceledBy === "produtor"
                    ? "Produtor"
                    : "Administrador"}
              </p>
              <p>
                <strong>Motivo:</strong> {order.cancellationReason ?? "sem motivo informado"}
              </p>
              {order.canceledAt && (
                <p>
                  <strong>Data/Hora:</strong> {formatOrderDate(order.canceledAt)}
                </p>
              )}
            </div>
          )}
          <p className="mt-1 text-sm font-semibold text-brand-900">
            Pagamento e condições: definidos diretamente entre as partes
          </p>
          {order.paymentNotes && (
            <p className="mt-1 text-xs text-muted-foreground">{order.paymentNotes}</p>
          )}
        </div>

        <div className="block w-full sm:w-auto sm:min-w-[180px]">
          <span className="text-xs font-semibold text-muted-foreground">Status</span>
          <p className="mt-1 inline-flex h-10 w-full items-center rounded-lg border border-border bg-canvas px-3 text-sm font-semibold text-brand-900">
            {order.status}
          </p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-canvas">
        {order.items.map((item) => (
          <li
            key={`${order.id}-${item.productId}`}
            className="flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div>
              <p className="font-semibold text-brand-900">{item.productName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.quantity.toLocaleString("pt-BR")} {item.unit} - R$ {item.unitPrice.toFixed(2)}
                /{item.unit}
              </p>
              {item.notes && (
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-brand-900">
                  {item.notes}
                </p>
              )}
            </div>
            <p className="text-sm font-bold text-brand-900">R$ {item.lineTotal.toFixed(2)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:flex sm:flex-wrap">
        {order.status === "Recebido" && (
          <div className="grid w-full gap-2 rounded-xl border border-border bg-canvas p-3 sm:grid-cols-[minmax(220px,280px)_auto] sm:items-end">
            <label className="block">
              <span className="text-xs font-semibold text-brand-900">Data e hora da entrega</span>
              <input
                type="datetime-local"
                value={deliveryAt}
                onChange={(event) => setDeliveryAt(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void confirmOrder()}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-900 px-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              <CalendarClock className="h-4 w-4" />
              {saving ? "Confirmando..." : "Confirmar pedido"}
            </button>
            {error && (
              <p className="rounded-lg bg-[var(--color-error-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-error-fg)] sm:col-span-2">
                {error}
              </p>
            )}
          </div>
        )}
        {order.status === "Em separação" && (
          <button
            type="button"
            onClick={() => void updateStatus(order.id, "Em entrega")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500 sm:h-10"
          >
            <Truck className="h-4 w-4 text-leaf-700" />
            Saiu para entrega
          </button>
        )}
        {order.status === "Em entrega" && (
          <div className="grid w-full gap-2 rounded-xl border border-border bg-canvas p-3 sm:grid-cols-[minmax(160px,220px)_auto] sm:items-end">
            <label className="block">
              <span className="text-xs font-semibold text-brand-900">Código do comprador</span>
              <input
                value={deliveryCode}
                onChange={(event) => setDeliveryCode(event.target.value)}
                inputMode="numeric"
                placeholder="Ex: 1234"
                className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void finishDelivery()}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-900 px-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              <PackageCheck className="h-4 w-4" />
              Concluir entrega
            </button>
          </div>
        )}
        {cancelAllowed && (
          <>
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--color-error-bg)] bg-white px-4 text-sm font-semibold text-[var(--color-error-fg)] hover:bg-[var(--color-error-bg)] transition-colors cursor-pointer disabled:opacity-60"
              >
                Cancelar solicitação
              </button>
            </div>

            <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-brand-900 font-bold">
                    Cancelar solicitação #{order.id}
                  </DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser
                    desfeita.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-brand-900">
                      Motivo do cancelamento <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="Informe o motivo do cancelamento"
                      rows={3}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-canvas transition-colors cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancel()}
                    disabled={!cancelReason.trim() || saving}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-error-bg)] px-4 text-sm font-semibold text-[var(--color-error-fg)] hover:bg-red-200 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    Confirmar Cancelamento
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
        {order.status === "Entregue" && (
          <>
            <div className="w-full rounded-xl border border-leaf-200 bg-leaf-50 p-4 text-sm text-brand-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-semibold">Entrega concluída</p>
                <p className="mt-1">Recibo: {order.receiptCode ?? "gerado na confirmação"}</p>
              </div>
              <div>
                {isRated ? (
                  <span className="inline-flex h-10 items-center justify-center rounded-lg bg-leaf-100 text-leaf-800 px-4 text-sm font-semibold">
                    Comprador Avaliado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsRatingModalOpen(true)}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-900 text-white px-4 text-sm font-semibold hover:bg-brand-800 transition-colors cursor-pointer"
                  >
                    Avaliar Comprador
                  </button>
                )}
              </div>
            </div>

            <Dialog open={isRatingModalOpen} onOpenChange={setIsRatingModalOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-brand-900 font-bold">Avaliar Comprador</DialogTitle>
                  <DialogDescription>
                    Como foi sua experiência com o comprador <strong>{order.buyerName}</strong> no
                    pedido #{order.id}?
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm font-semibold text-brand-900">
                      Nota (1 a 5 estrelas)
                    </span>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingValue(star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(null)}
                          className="text-amber-400 hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                        >
                          <Star
                            className="h-8 w-8"
                            fill={
                              (hoveredRating !== null ? star <= hoveredRating : star <= ratingValue)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-brand-900">
                      Comentário <span className="text-xs text-muted-foreground">(opcional)</span>
                    </label>
                    <textarea
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      placeholder="Deixe um comentário sobre o comprador..."
                      rows={3}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-900 focus:border-leaf-600 focus:outline-none"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => setIsRatingModalOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-canvas transition-colors cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitRating()}
                    disabled={submittingRating}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    {submittingRating ? "Enviando..." : "Enviar Avaliação"}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </li>
  );
}

function producerOrderTotal(order: SavedOrder) {
  return order.items.reduce((sum, item) => sum + item.lineTotal, 0);
}

function productSummary(orders: SavedOrder[]) {
  const map = new Map<string, { name: string; quantity: number; unit: string; total: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = map.get(item.productName) ?? {
        name: item.productName,
        quantity: 0,
        unit: item.unit,
        total: 0,
      };
      current.quantity += item.quantity;
      current.total += item.lineTotal;
      map.set(item.productName, current);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

function getProducerOrders(
  orders: SavedOrder[],
  alreadyScoped: boolean,
  currentProducerId?: string,
) {
  if (alreadyScoped) return orders.filter((order) => order.items.length > 0);
  const targetId = currentProducerId || PRODUCER_ID;
  return orders
    .map((order) => ({
      ...order,
      items: order.items.filter(
        (item) => item.producerId === targetId || item.producerId === "produtor",
      ),
    }))
    .filter((order) => order.items.length > 0);
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-canvas p-8 text-center">
      <h3 className="text-base font-semibold text-brand-900">Nenhuma solicitação recebida</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Quando um comprador enviar interesse nos produtos, a solicitação aparece aqui.
      </p>
    </div>
  );
}

function ActionItem({ title, text }: { title: string; text: string }) {
  return (
    <li className="rounded-xl border border-border bg-canvas p-4">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </li>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold text-brand-900">
        <Icon className="h-4 w-4 text-leaf-700" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-100 text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-brand-900">{value}</p>
    </div>
  );
}
