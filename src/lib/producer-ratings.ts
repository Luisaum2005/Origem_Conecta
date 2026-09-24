import { supabase } from "@/lib/supabase";

// Comprador avalia o produtor. O sentido inverso (produtor avalia comprador) fica em ratings.ts.
export type ProducerRating = {
  id: string;
  orderId: string;
  buyerId: string;
  producerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

const STORAGE_KEY = "origem-conecta-producer-ratings";

type RatingRow = {
  id: string;
  order_id: string;
  buyer_id: string;
  producer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

const fromRow = (row: RatingRow): ProducerRating => ({
  id: row.id,
  orderId: row.order_id,
  buyerId: row.buyer_id,
  producerId: row.producer_id,
  rating: row.rating,
  comment: row.comment || undefined,
  createdAt: row.created_at,
});

function readLocal(): ProducerRating[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as ProducerRating[];
  } catch {
    return [];
  }
}

export async function createProducerRating(
  rating: Omit<ProducerRating, "id" | "createdAt">,
): Promise<ProducerRating> {
  if (rating.rating < 1 || rating.rating > 5) {
    throw new Error("A avaliação deve ser entre 1 e 5 estrelas.");
  }
  if (supabase) {
    const { data, error } = await supabase
      .from("producer_ratings")
      .insert({
        order_id: rating.orderId,
        buyer_id: rating.buyerId,
        producer_id: rating.producerId,
        rating: rating.rating,
        comment: rating.comment || null,
      })
      .select("id,order_id,buyer_id,producer_id,rating,comment,created_at")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Esta entrega já foi avaliada.");
      if (error.code === "42501") {
        throw new Error("Só é possível avaliar pedidos seus que já foram entregues.");
      }
      throw error;
    }
    return fromRow(data as RatingRow);
  }
  const all = readLocal();
  if (all.some((r) => r.orderId === rating.orderId && r.producerId === rating.producerId)) {
    throw new Error("Esta entrega já foi avaliada.");
  }
  const created: ProducerRating = {
    ...rating,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([created, ...all]));
  return created;
}

export async function getProducerRatingForOrder(
  orderId: string,
  producerId: string,
): Promise<ProducerRating | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from("producer_ratings")
      .select("id,order_id,buyer_id,producer_id,rating,comment,created_at")
      .eq("order_id", orderId)
      .eq("producer_id", producerId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as RatingRow) : null;
  }
  return readLocal().find((r) => r.orderId === orderId && r.producerId === producerId) ?? null;
}
