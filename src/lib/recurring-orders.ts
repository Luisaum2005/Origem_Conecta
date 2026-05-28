import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { type SavedOrderItem } from "@/lib/orders";
import { useEffect, useState } from "react";

export type RecurringOrder = {
  id: string;
  createdAt: string;
  name: string;
  frequency: string;
  preferredDeliveryDay: string;
  active: boolean;
  items: SavedOrderItem[];
};

type RemoteRecurringOrder = {
  id: string;
  criado_em: string;
  nome: string;
  frequencia: string;
  dia_preferido_entrega: string | null;
  ativo: boolean;
  itens: SavedOrderItem[] | null;
};

export const RECURRING_ORDERS_STORAGE_KEY = "origem-conecta-recurring-orders";

function readRecurringOrders() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(RECURRING_ORDERS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as RecurringOrder[];
  } catch {
    return [];
  }
}

function mapRemoteRecurringOrder(row: RemoteRecurringOrder): RecurringOrder {
  return {
    id: row.id,
    createdAt: row.criado_em,
    name: row.nome,
    frequency: row.frequencia,
    preferredDeliveryDay: row.dia_preferido_entrega ?? "",
    active: row.ativo,
    items: row.itens ?? [],
  };
}

async function getBuyerId(profileId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("buyers")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function loadRemoteRecurringOrders(profileId: string) {
  if (!supabase) return null;
  const buyerId = await getBuyerId(profileId);
  if (!buyerId) return [];

  const { data, error } = await supabase
    .from("recurring_orders")
    .select("id,criado_em,nome,frequencia,dia_preferido_entrega,ativo,itens")
    .eq("buyer_id", buyerId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRemoteRecurringOrder(row as RemoteRecurringOrder));
}

async function createRemoteRecurringOrder(profileId: string, order: RecurringOrder) {
  if (!supabase) return;
  const buyerId = await getBuyerId(profileId);
  if (!buyerId) return;

  const { data, error } = await supabase
    .from("recurring_orders")
    .insert({
      buyer_id: buyerId,
      nome: order.name,
      frequencia: order.frequency,
      dia_preferido_entrega: order.preferredDeliveryDay || null,
      ativo: order.active,
      itens: order.items,
    })
    .select("id,criado_em")
    .single();
  if (error) throw error;

  return { id: data.id as string, createdAt: data.criado_em as string };
}

async function updateRemoteRecurringActive(id: string, active: boolean) {
  if (!supabase) return;
  const { error } = await supabase.from("recurring_orders").update({ ativo: active }).eq("id", id);
  if (error) throw error;
}

async function deleteRemoteRecurringOrder(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("recurring_orders").delete().eq("id", id);
  if (error) throw error;
}

export function useRecurringOrders() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrder[]>(readRecurringOrders);

  useEffect(() => {
    window.localStorage.setItem(RECURRING_ORDERS_STORAGE_KEY, JSON.stringify(recurringOrders));
  }, [recurringOrders]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || profile?.tipo !== "comprador") return;
    let active = true;

    loadRemoteRecurringOrders(profile.id)
      .then((remoteOrders) => {
        if (active && remoteOrders) setRecurringOrders(remoteOrders);
      })
      .catch((error) => {
        console.warn("Nao foi possivel carregar pedidos recorrentes do Supabase.", error);
      });

    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile?.id, profile?.tipo]);

  const addRecurringOrder = (
    order: Omit<RecurringOrder, "id" | "createdAt" | "active"> & { active?: boolean },
  ) => {
    const next: RecurringOrder = {
      ...order,
      id: String(Math.floor(1000 + Math.random() * 9000)),
      createdAt: new Date().toISOString(),
      active: order.active ?? true,
    };
    setRecurringOrders((current) => [next, ...current]);

    if (supabase && isSupabaseConfigured && profile?.tipo === "comprador") {
      createRemoteRecurringOrder(profile.id, next)
        .then((remote) => {
          if (!remote) return;
          setRecurringOrders((current) =>
            current.map((item) =>
              item.id === next.id ? { ...item, id: remote.id, createdAt: remote.createdAt } : item,
            ),
          );
        })
        .catch((error) => {
          console.warn("Nao foi possivel salvar pedido recorrente no Supabase.", error);
        });
    }

    return next;
  };

  const toggleRecurringOrder = (id: string) => {
    const next = recurringOrders.find((item) => item.id === id);
    const nextActive = !next?.active;
    setRecurringOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, active: nextActive } : order)),
    );
    if (supabase && isSupabaseConfigured) {
      updateRemoteRecurringActive(id, nextActive).catch((error) => {
        console.warn("Nao foi possivel atualizar pedido recorrente no Supabase.", error);
      });
    }
  };

  const removeRecurringOrder = (id: string) => {
    setRecurringOrders((current) => current.filter((order) => order.id !== id));
    if (supabase && isSupabaseConfigured) {
      deleteRemoteRecurringOrder(id).catch((error) => {
        console.warn("Nao foi possivel excluir pedido recorrente no Supabase.", error);
      });
    }
  };

  return { recurringOrders, addRecurringOrder, toggleRecurringOrder, removeRecurringOrder };
}
