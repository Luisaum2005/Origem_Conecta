import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { getBuyerId } from "./orders";

export type BuyerRating = {
  id: string;
  orderId: string;
  buyerId: string;
  producerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  producerName?: string;
};

const RATINGS_STORAGE_KEY = "origem-conecta-buyer-ratings";

export function readLocalRatings(): BuyerRating[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(RATINGS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as BuyerRating[];
  } catch {
    return [];
  }
}

export function writeLocalRatings(ratings: BuyerRating[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(ratings));
}

export async function createBuyerRating(rating: Omit<BuyerRating, "id" | "createdAt">) {
  if (supabase) {
    // Validate that rating is between 1 and 5
    if (rating.rating < 1 || rating.rating > 5) {
      throw new Error("A avaliação deve ser entre 1 e 5 estrelas.");
    }

    // Validate order status is delivered
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("status, buyer_id")
      .eq("id", rating.orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Pedido não encontrado.");
    }

    if (order.status !== "entregue") {
      throw new Error("Apenas pedidos concluídos podem ser avaliados.");
    }

    if (order.buyer_id !== rating.buyerId) {
      throw new Error("O comprador da avaliação não corresponde ao comprador do pedido.");
    }

    const { data, error } = await supabase
      .from("buyer_ratings")
      .insert({
        order_id: rating.orderId,
        buyer_id: rating.buyerId,
        producer_id: rating.producerId,
        rating: rating.rating,
        comment: rating.comment || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Este pedido já foi avaliado.");
      }
      throw error;
    }

    return {
      id: data.id,
      orderId: data.order_id,
      buyerId: data.buyer_id,
      producerId: data.producer_id,
      rating: data.rating,
      comment: data.comment || undefined,
      createdAt: data.created_at,
    };
  } else {
    // Local storage fallback
    const all = readLocalRatings();
    if (all.some((r) => r.orderId === rating.orderId)) {
      throw new Error("Este pedido já foi avaliado.");
    }

    const newRating: BuyerRating = {
      ...rating,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };

    const updated = [newRating, ...all];
    writeLocalRatings(updated);
    return newRating;
  }
}

export async function getBuyerRatings(buyerId: string): Promise<BuyerRating[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("buyer_ratings")
      .select(
        `
        id,
        order_id,
        buyer_id,
        producer_id,
        rating,
        comment,
        created_at,
        producers (
          nome_propriedade,
          responsavel
        )
      `,
      )
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    interface RatingRow {
      id: string;
      order_id: string;
      buyer_id: string;
      producer_id: string;
      rating: number;
      comment: string | null;
      created_at: string;
      producers: {
        nome_propriedade: string | null;
        responsavel: string | null;
      } | null;
    }

    return ((data as unknown as RatingRow[]) ?? []).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      buyerId: row.buyer_id,
      producerId: row.producer_id,
      rating: row.rating,
      comment: row.comment || undefined,
      createdAt: row.created_at,
      producerName: row.producers?.nome_propriedade || row.producers?.responsavel || "Produtor",
    }));
  } else {
    return readLocalRatings()
      .filter((r) => r.buyerId === buyerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function getRatingForOrder(orderId: string): Promise<BuyerRating | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from("buyer_ratings")
      .select(
        `
        id,
        order_id,
        buyer_id,
        producer_id,
        rating,
        comment,
        created_at
      `,
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      orderId: data.order_id,
      buyerId: data.buyer_id,
      producerId: data.producer_id,
      rating: data.rating,
      comment: data.comment || undefined,
      createdAt: data.created_at,
    };
  } else {
    return readLocalRatings().find((r) => r.orderId === orderId) || null;
  }
}

export function useBuyerRatings(buyerId?: string) {
  const { profile, isSupabaseConfigured } = useAuth();
  const [ratings, setRatings] = useState<BuyerRating[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        let targetBuyerId = buyerId;
        if (!targetBuyerId && profile?.tipo === "comprador") {
          targetBuyerId = (await getBuyerId(profile.id)) ?? undefined;
        }

        if (!targetBuyerId) {
          setRatings([]);
          return;
        }

        if (supabase && isSupabaseConfigured) {
          const remoteRatings = await getBuyerRatings(targetBuyerId);
          if (active) setRatings(remoteRatings);
        } else {
          const local = readLocalRatings().filter((r) => r.buyerId === targetBuyerId);
          if (active) setRatings(local);
        }
      } catch (err) {
        console.error("Erro ao carregar avaliações:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [buyerId, profile, isSupabaseConfigured]);

  const addRating = async (rating: Omit<BuyerRating, "id" | "createdAt">) => {
    if (supabase && isSupabaseConfigured) {
      const newRating = await createBuyerRating(rating);
      setRatings((prev) => [newRating, ...prev]);
      return newRating;
    } else {
      const newRating = await createBuyerRating(rating);
      const fullRating: BuyerRating = {
        ...newRating,
        producerName: profile?.nome || "Produtor",
      };
      setRatings((prev) => [fullRating, ...prev]);
      return fullRating;
    }
  };

  return { ratings, loading, addRating };
}
