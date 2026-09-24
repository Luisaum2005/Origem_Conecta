import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, CircleCheck, Star, X } from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ProductFallback } from "@/components/marketplace/ProductCard";
import { orderItemsLabel, orderProducersLabel } from "@/lib/order-status";
import { DataLoading } from "@/components/system/DataLoadState";
import { useAuth } from "@/lib/auth";
import { useAvailableProducts } from "@/lib/available-products";
import { getBuyerId, useOrders } from "@/lib/orders";
import { getRatingForOrder, useBuyerRatings } from "@/lib/ratings";

export const Route = createFileRoute("/rating")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Rating />
    </RequireProfile>
  ),
});

const CRITERIA = ["Qualidade dos produtos", "Pontualidade", "Embalagem"] as const;
const HIGHLIGHTS = [
  "Produto fresco",
  "Bem embalado",
  "No horário",
  "Quantidade certa",
  "Atendimento",
];

function Rating() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { orders, loading } = useOrders();
  const products = useAvailableProducts();
  const { addRating } = useBuyerRatings();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [highlights, setHighlights] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  const order = useMemo(
    () =>
      orders.find((item) => item.id === id) ?? orders.find((item) => item.status === "Entregue"),
    [id, orders],
  );

  useEffect(() => {
    if (!order) return;
    let active = true;
    getRatingForOrder(order.id)
      .then((rating) => active && setAlreadyRated(Boolean(rating)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [order]);

  const close = () => void navigate({ to: "/orders" });
  const complete = CRITERIA.every((criterion) => (scores[criterion] ?? 0) > 0);

  const submit = async () => {
    if (!order || !profile || !complete) return;
    setSending(true);
    try {
      const buyerId = (await getBuyerId(profile.id)) ?? profile.id;
      const average = Math.round(
        CRITERIA.reduce((sum, criterion) => sum + scores[criterion], 0) / CRITERIA.length,
      );
      const details = [
        comment.trim(),
        highlights.length ? `Destaques: ${highlights.join(", ")}.` : "",
        CRITERIA.map((criterion) => `${criterion}: ${scores[criterion]}/5`).join(" · "),
      ]
        .filter(Boolean)
        .join("\n");
      await addRating({
        orderId: order.id,
        buyerId,
        producerId: order.items[0]?.producerId ?? "",
        rating: average,
        comment: details,
      });
      toast.success("Avaliação enviada. Obrigado!");
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a avaliação.");
    } finally {
      setSending(false);
    }
  };

  const product = order
    ? products.find((item) => item.id === order.items[0]?.productId)
    : undefined;
  const deliveredOn = order?.deliveredAt
    ? new Date(order.deliveredAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-06-avaliacao">
        <div className="m-status" />
        <div className="m-hd">
          <button type="button" className="m-round" onClick={close} aria-label="Fechar">
            <X className="lucide" aria-hidden />
          </button>
          <h1>Avaliar entrega</h1>
          <span style={{ width: "44px" }} />
        </div>

        {!order ? (
          <div className="m-pad">
            {loading ? (
              <DataLoading label="Carregando pedido..." />
            ) : (
              <div className="m-card m-empty">
                <b>Nenhuma entrega para avaliar</b>
                <span>Quando um pedido for entregue, você avalia por aqui.</span>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="m-who m-card">
              {product?.imageUrl ? (
                <img src={product.imageUrl} alt="" />
              ) : (
                <ProductFallback
                  category={product?.category ?? ""}
                  name={order.items[0]?.productName ?? ""}
                  className="m-whof"
                  label={false}
                />
              )}
              <div>
                <span className="m-muted">
                  #{order.id}
                  {deliveredOn ? ` · entregue ${deliveredOn}` : ` · ${order.status.toLowerCase()}`}
                </span>
                <b>{orderProducersLabel(order)}</b>
                <span className="m-muted">{orderItemsLabel(order, true)}</span>
              </div>
            </div>

            {alreadyRated ? (
              <div className="m-pad">
                <div className="m-card m-empty">
                  <CircleCheck className="lucide m-ok" aria-hidden />
                  <b>Entrega já avaliada</b>
                  <span>Obrigado! Sua avaliação ajuda os produtores a melhorar.</span>
                </div>
              </div>
            ) : order.status !== "Entregue" ? (
              <div className="m-pad">
                <div className="m-card m-empty">
                  <b>A avaliação libera após a entrega</b>
                  <span>Confirme o recebimento no acompanhamento do pedido.</span>
                </div>
              </div>
            ) : (
              <>
                <h2 className="m-q">Como foi sua entrega?</h2>
                <div className="m-rates m-card">
                  {CRITERIA.map((criterion) => (
                    <div key={criterion} className="m-rt">
                      <span>{criterion}</span>
                      <div className="m-stars" role="radiogroup" aria-label={criterion}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={scores[criterion] === value}
                            aria-label={`${value} de 5 em ${criterion}`}
                            onClick={() =>
                              setScores((current) => ({ ...current, [criterion]: value }))
                            }
                          >
                            <Star
                              className={`lucide${value <= (scores[criterion] ?? 0) ? " m-on" : ""}`}
                              aria-hidden
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="m-lb">O que se destacou?</h3>
                <div className="m-tags">
                  {HIGHLIGHTS.map((tag) => {
                    const on = highlights.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={on}
                        className={`m-pill${on ? " m-sel" : ""}`}
                        onClick={() =>
                          setHighlights((current) =>
                            on ? current.filter((item) => item !== tag) : [...current, tag],
                          )
                        }
                      >
                        {on && <Check className="lucide" aria-hidden />}
                        {tag}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  className="m-ta m-card"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Conte como foi a entrega (opcional)"
                  aria-label="Comentário sobre a entrega"
                />

                <div className="m-footer">
                  <button
                    type="button"
                    className="m-btn m-primary"
                    disabled={!complete || sending}
                    onClick={() => void submit()}
                  >
                    {sending ? "Enviando..." : "Enviar avaliação"}
                  </button>
                  <div style={{ textAlign: "center" }}>
                    <button type="button" className="m-btn m-text" onClick={close}>
                      Avaliar depois
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
