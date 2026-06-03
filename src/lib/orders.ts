import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type OrderStatus = "Recebido" | "Em separação" | "Em entrega" | "Entregue";

export type SavedOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  producerId: string;
  producerName: string;
  manualProducerChoice: boolean;
  lineTotal: number;
};

export type SavedOrder = {
  id: string;
  createdAt: string;
  buyerName: string;
  status: OrderStatus;
  subtotal: number;
  delivery: number;
  total: number;
  items: SavedOrderItem[];
  deliveryEta: string;
};

type RemoteOrderItem = {
  producer_id: string | null;
  product_ref: string | null;
  product_name: string;
  quantidade: number | string;
  unidade: string;
  preco_unitario: number | string;
  producer_ref: string | null;
  producer_name: string | null;
  escolha_manual_produtor: boolean;
  line_total: number | string;
};

type RemoteOrder = {
  id: string;
  criado_em: string;
  buyer_name: string | null;
  status: "recebido" | "em_separacao" | "em_entrega" | "entregue" | "cancelado";
  subtotal: number | string | null;
  delivery: number | string | null;
  total: number | string | null;
  entrega_label: string | null;
  order_items?: RemoteOrderItem[] | null;
};

export const ORDERS_STORAGE_KEY = "origem-conecta-orders";

const appToDbStatus: Record<OrderStatus, RemoteOrder["status"]> = {
  Recebido: "recebido",
  "Em separação": "em_separacao",
  "Em entrega": "em_entrega",
  Entregue: "entregue",
};

const dbToAppStatus: Record<RemoteOrder["status"], OrderStatus> = {
  recebido: "Recebido",
  em_separacao: "Em separação",
  em_entrega: "Em entrega",
  entregue: "Entregue",
  cancelado: "Recebido",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readOrders() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(ORDERS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as SavedOrder[];
  } catch {
    return [];
  }
}

function mapRemoteOrder(order: RemoteOrder): SavedOrder {
  return {
    id: order.id,
    createdAt: order.criado_em,
    buyerName: order.buyer_name || "Comprador",
    status: dbToAppStatus[order.status],
    subtotal: Number(order.subtotal || 0),
    delivery: Number(order.delivery || 0),
    total: Number(order.total || 0),
    deliveryEta: order.entrega_label || "Proximo ciclo",
    items: (order.order_items ?? []).map((item) => ({
      productId: item.product_ref || item.product_name,
      productName: item.product_name,
      quantity: Number(item.quantidade || 0),
      unit: item.unidade,
      unitPrice: Number(item.preco_unitario || 0),
      producerId: item.producer_id || item.producer_ref || item.producer_name || "produtor",
      producerName: item.producer_name || "Produtor",
      manualProducerChoice: item.escolha_manual_produtor,
      lineTotal: Number(item.line_total || 0),
    })),
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

async function getProducerId(profileId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("producers")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function loadRemoteOrders(
  profileId: string,
  profileType: "comprador" | "produtor" | "admin",
) {
  if (!supabase) return null;
  let select =
    "id,criado_em,buyer_name,status,subtotal,delivery,total,entrega_label,order_items(product_ref,product_name,quantidade,unidade,preco_unitario,producer_id,producer_ref,producer_name,escolha_manual_produtor,line_total)";

  if (profileType === "produtor") {
    const producerId = await getProducerId(profileId);
    if (!producerId) return [];
    select =
      "id,criado_em,buyer_name,status,subtotal,delivery,total,entrega_label,order_items!inner(product_ref,product_name,quantidade,unidade,preco_unitario,producer_id,producer_ref,producer_name,escolha_manual_produtor,line_total)";
    const { data, error } = await supabase
      .from("orders")
      .select(select)
      .eq("order_items.producer_id", producerId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((order) => mapRemoteOrder(order as unknown as RemoteOrder));
  }

  let query = supabase.from("orders").select(select).order("criado_em", { ascending: false });

  if (profileType === "comprador") {
    const buyerId = await getBuyerId(profileId);
    if (!buyerId) return [];
    query = query.eq("buyer_id", buyerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((order) => mapRemoteOrder(order as unknown as RemoteOrder));
}

async function createRemoteOrder(profileId: string, order: SavedOrder) {
  if (!supabase) return null;
  const buyerId = await getBuyerId(profileId);
  if (!buyerId) {
    throw new Error("Cadastro de comprador nao encontrado para este usuario.");
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      buyer_id: buyerId,
      buyer_name: order.buyerName,
      status: appToDbStatus[order.status],
      subtotal: order.subtotal,
      delivery: order.delivery,
      total: order.total,
      entrega_label: order.deliveryEta,
    })
    .select("id,criado_em")
    .single();
  if (error) throw error;

  const payload = order.items.map((item) => ({
    order_id: data.id,
    product_ref: item.productId,
    product_name: item.productName,
    quantidade: item.quantity,
    unidade: item.unit,
    preco_unitario: item.unitPrice,
    producer_id: isUuid(item.producerId) ? item.producerId : null,
    producer_ref: item.producerId,
    producer_name: item.producerName,
    escolha_manual_produtor: item.manualProducerChoice,
    line_total: item.lineTotal,
  }));

  if (payload.length) {
    const { error: itemsError } = await supabase.from("order_items").insert(payload);
    if (itemsError) throw itemsError;
  }

  return { id: data.id as string, createdAt: data.criado_em as string };
}

async function updateRemoteStatus(id: string, status: OrderStatus) {
  if (!supabase) return;
  const { error } = await supabase
    .from("orders")
    .update({ status: appToDbStatus[status] })
    .eq("id", id);
  if (error) throw error;
}

export function useOrders() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [orders, setOrders] = useState<SavedOrder[]>(readOrders);

  useEffect(() => {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !profile) return;
    let active = true;

    loadRemoteOrders(profile.id, profile.tipo)
      .then((remoteOrders) => {
        if (active && remoteOrders) setOrders(remoteOrders);
      })
      .catch((error) => {
        console.warn("Nao foi possivel carregar pedidos do Supabase.", error);
      });

    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile]);

  const addOrder = async (order: Omit<SavedOrder, "id" | "createdAt" | "status">) => {
    const next: SavedOrder = {
      ...order,
      id: String(Math.floor(1000 + Math.random() * 9000)),
      createdAt: new Date().toISOString(),
      status: "Recebido",
    };

    if (supabase && isSupabaseConfigured && profile?.tipo === "comprador") {
      const remote = await createRemoteOrder(profile.id, next);
      const savedOrder = remote ? { ...next, id: remote.id, createdAt: remote.createdAt } : next;
      setOrders((current) => [savedOrder, ...current]);
      return savedOrder;
    }

    setOrders((current) => [next, ...current]);
    return next;
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    if (supabase && isSupabaseConfigured) {
      await updateRemoteStatus(id, status);
    }
    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, status } : order)),
    );
  };

  return { orders, addOrder, updateStatus };
}

export function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
