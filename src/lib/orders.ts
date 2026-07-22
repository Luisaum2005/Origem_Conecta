import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type PaymentMethod = "Pix" | "Dinheiro na entrega" | "A combinar";

export const PAYMENT_METHODS: PaymentMethod[] = ["Pix", "Dinheiro na entrega", "A combinar"];

export type OrderStatus = "Recebido" | "Em separação" | "Em entrega" | "Entregue" | "Cancelado";

export type SavedOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  producerId: string;
  producerName: string;
  sellerOrganizationId?: string;
  sellerOrganizationName?: string;
  sellerOrganizationCnpj?: string;
  manualProducerChoice: boolean;
  lineTotal: number;
  notes?: string;
  producerConfirmedAt?: string;
  producerShippedAt?: string;
  producerDeliveredAt?: string;
};

export type SavedOrder = {
  id: string;
  buyerId?: string;
  createdAt: string;
  buyerName: string;
  status: OrderStatus;
  subtotal: number;
  delivery: number;
  total: number;
  items: SavedOrderItem[];
  deliveryEta: string;
  deliveryAt?: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancellationDeadline?: string;
  canceledAt?: string;
  canceledBy?: "comprador" | "produtor" | "admin";
  cancellationReason?: string;
  deliveryCode?: string;
  receiptCode?: string;
  complaint?: string;
  complaintStatus?: "Aberta" | "Resolvida";
  complaintCreatedAt?: string;
  originQuoteId?: string;
  paymentMethod?: PaymentMethod;
  paymentNotes?: string;
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
  observacoes?: string | null;
  seller_organization_id?: string | null;
  seller_organization_name?: string | null;
  seller_organization_cnpj?: string | null;
  producer_confirmed_at?: string | null;
  producer_shipped_at?: string | null;
  producer_delivered_at?: string | null;
};

type RemoteOrder = {
  id: string;
  buyer_id?: string | null;
  criado_em: string;
  buyer_name: string | null;
  status: "recebido" | "em_separacao" | "em_entrega" | "entregue" | "cancelado";
  subtotal: number | string | null;
  delivery: number | string | null;
  total: number | string | null;
  entrega_label: string | null;
  entrega_prevista?: string | null;
  confirmado_em?: string | null;
  saiu_entrega_em?: string | null;
  entregue_em?: string | null;
  cancelamento_limite_em?: string | null;
  cancelado_em?: string | null;
  cancelado_por?: string | null;
  motivo_cancelamento?: string | null;
  codigo_entrega?: string | null;
  codigo_recibo?: string | null;
  reclamacao_texto?: string | null;
  reclamacao_status?: string | null;
  reclamacao_criada_em?: string | null;
  origem_solicitacao_id?: string | null;
  payment_method?: string | null;
  payment_notes?: string | null;
  order_items?: RemoteOrderItem[] | null;
};

export const ORDERS_STORAGE_KEY = "origem-conecta-orders";
export const CANCELLATION_LIMIT_HOURS = 2;

const appToDbStatus: Record<OrderStatus, RemoteOrder["status"]> = {
  Recebido: "recebido",
  "Em separação": "em_separacao",
  "Em entrega": "em_entrega",
  Entregue: "entregue",
  Cancelado: "cancelado",
};

const dbToAppStatus: Record<RemoteOrder["status"], OrderStatus> = {
  recebido: "Recebido",
  em_separacao: "Em separação",
  em_entrega: "Em entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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

function normalizeStatus(status: string): OrderStatus {
  if (status === "Em separação" || status.includes("separa")) return "Em separação";
  if (status === "Em entrega") return "Em entrega";
  if (status === "Entregue") return "Entregue";
  if (status === "Cancelado") return "Cancelado";
  return "Recebido";
}

export function formatDeliveryDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizePaymentMethod(value?: string | null): PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod) ? (value as PaymentMethod) : "A combinar";
}

function addHours(value: string, hours: number) {
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function generateDeliveryCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateReceiptCode() {
  return `OC-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function canCancelOrder(order: SavedOrder) {
  if (order.status === "Entregue" || order.status === "Cancelado") {
    return false;
  }
  const deadline =
    order.cancellationDeadline ?? addHours(order.createdAt, CANCELLATION_LIMIT_HOURS);
  return Date.now() <= new Date(deadline).getTime();
}

export function formatCancellationDeadline(order: SavedOrder) {
  return formatDeliveryDateTime(
    order.cancellationDeadline ?? addHours(order.createdAt, CANCELLATION_LIMIT_HOURS),
  );
}

function mapRemoteOrder(order: RemoteOrder, deriveProducerProgress = false): SavedOrder {
  const deliveryAt = order.entrega_prevista ?? undefined;
  const items = (order.order_items ?? []).map((item) => ({
    productId: item.product_ref || item.product_name,
    productName: item.product_name,
    quantity: Number(item.quantidade || 0),
    unit: item.unidade,
    unitPrice: Number(item.preco_unitario || 0),
    producerId: item.producer_id || item.producer_ref || item.producer_name || "produtor",
    producerName: item.producer_name || "Produtor",
    sellerOrganizationId: item.seller_organization_id ?? undefined,
    sellerOrganizationName: item.seller_organization_name ?? undefined,
    sellerOrganizationCnpj: item.seller_organization_cnpj ?? undefined,
    manualProducerChoice: item.escolha_manual_produtor,
    lineTotal: Number(item.line_total || 0),
    notes: item.observacoes || undefined,
    producerConfirmedAt: item.producer_confirmed_at ?? undefined,
    producerShippedAt: item.producer_shipped_at ?? undefined,
    producerDeliveredAt: item.producer_delivered_at ?? undefined,
  }));
  const producerStatus: OrderStatus | undefined = deriveProducerProgress
    ? items.length > 0 && items.every((item) => item.producerDeliveredAt)
      ? "Entregue"
      : items.length > 0 && items.every((item) => item.producerShippedAt)
        ? "Em entrega"
        : items.length > 0 && items.every((item) => item.producerConfirmedAt)
          ? "Em separação"
          : undefined
    : undefined;
  return {
    id: order.id,
    buyerId: order.buyer_id ?? undefined,
    createdAt: order.criado_em,
    buyerName: order.buyer_name || "Comprador",
    status: producerStatus ?? dbToAppStatus[order.status],
    subtotal: Number(order.subtotal || 0),
    delivery: Number(order.delivery || 0),
    total: Number(order.total || 0),
    deliveryAt,
    confirmedAt: order.confirmado_em ?? undefined,
    shippedAt: order.saiu_entrega_em ?? undefined,
    deliveredAt: order.entregue_em ?? undefined,
    cancellationDeadline:
      order.cancelamento_limite_em ?? addHours(order.criado_em, CANCELLATION_LIMIT_HOURS),
    canceledAt: order.cancelado_em ?? undefined,
    canceledBy: (order.cancelado_por as SavedOrder["canceledBy"]) ?? undefined,
    cancellationReason: order.motivo_cancelamento ?? undefined,
    deliveryCode: order.codigo_entrega ?? undefined,
    receiptCode: order.codigo_recibo ?? undefined,
    complaint: order.reclamacao_texto ?? undefined,
    complaintStatus:
      order.reclamacao_status === "resolvida"
        ? "Resolvida"
        : order.reclamacao_status === "aberta"
          ? "Aberta"
          : undefined,
    complaintCreatedAt: order.reclamacao_criada_em ?? undefined,
    deliveryEta:
      order.entrega_label ||
      (deliveryAt ? formatDeliveryDateTime(deliveryAt) : "Aguardando confirmação do produtor"),
    originQuoteId: order.origem_solicitacao_id ?? undefined,
    paymentMethod: normalizePaymentMethod(order.payment_method),
    paymentNotes: order.payment_notes ?? undefined,
    items,
  };
}

export async function getBuyerId(profileId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("buyers")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function getProducerId(profileId: string) {
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
  profileType: "comprador" | "produtor" | "organizacao" | "admin",
) {
  if (!supabase) return null;
  if (profileType === "organizacao") return [];
  let select =
    "id,buyer_id,criado_em,buyer_name,status,subtotal,delivery,total,entrega_label,entrega_prevista,confirmado_em,saiu_entrega_em,entregue_em,cancelamento_limite_em,cancelado_em,cancelado_por,motivo_cancelamento,codigo_entrega,codigo_recibo,reclamacao_texto,reclamacao_status,reclamacao_criada_em,origem_solicitacao_id,payment_method,payment_notes,order_items(product_ref,product_name,quantidade,unidade,preco_unitario,producer_id,producer_ref,producer_name,escolha_manual_produtor,line_total,observacoes,seller_organization_id,seller_organization_name,seller_organization_cnpj,producer_confirmed_at,producer_shipped_at,producer_delivered_at)";

  if (profileType === "produtor") {
    const producerId = await getProducerId(profileId);
    if (!producerId) return [];
    select =
      "id,buyer_id,criado_em,buyer_name,status,subtotal,delivery,total,entrega_label,entrega_prevista,confirmado_em,saiu_entrega_em,entregue_em,cancelamento_limite_em,cancelado_em,cancelado_por,motivo_cancelamento,codigo_entrega,codigo_recibo,reclamacao_texto,reclamacao_status,reclamacao_criada_em,origem_solicitacao_id,payment_method,payment_notes,order_items!inner(product_ref,product_name,quantidade,unidade,preco_unitario,producer_id,producer_ref,producer_name,escolha_manual_produtor,line_total,observacoes,seller_organization_id,seller_organization_name,seller_organization_cnpj,producer_confirmed_at,producer_shipped_at,producer_delivered_at)";
    const { data, error } = await supabase
      .from("orders")
      .select(select)
      .eq("order_items.producer_id", producerId)
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((order) => mapRemoteOrder(order as unknown as RemoteOrder, true));
  }

  let query = supabase
    .from("orders")
    .select(select)
    .order("criado_em", { ascending: false })
    .limit(100);

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
    throw new Error("Cadastro de comprador não encontrado para este usuário.");
  }

  const itemsWithoutProducer = order.items.filter((item) => !isUuid(item.producerId));
  if (itemsWithoutProducer.length) {
    throw new Error(
      "Um ou mais produtos não estão vinculados a um produtor real. Atualize o portfólio e tente novamente.",
    );
  }

  const { data, error } = await supabase.rpc("secure_create_portfolio_order", {
    p_order: {
      buyerName: order.buyerName,
      delivery: order.delivery,
      deliveryEta: order.deliveryEta,
      deliveryAt: order.deliveryAt ?? null,
      paymentMethod: order.paymentMethod ?? "A combinar",
      paymentNotes: order.paymentNotes ?? null,
    },
    p_items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      manualProducerChoice: item.manualProducerChoice,
      notes: item.notes ?? null,
    })),
  });
  if (error) throw error;
  const result = data as { id: string; createdAt: string } | null;
  if (!result?.id) throw new Error("O pedido não foi criado.");
  return result;
}

async function updateRemoteStatus(id: string, status: OrderStatus) {
  if (!supabase) return;
  if (status !== "Em entrega") {
    throw new Error("Transição de status não permitida por esta operação.");
  }
  const { error } = await supabase.rpc("secure_ship_order", { p_order_id: id });
  if (error) throw error;
}

async function confirmRemoteDelivery(id: string, deliveryAt: string) {
  if (!supabase) return;
  const deliveryEta = formatDeliveryDateTime(deliveryAt);
  const { error } = await supabase.rpc("secure_confirm_order", {
    p_order_id: id,
    p_delivery_at: new Date(deliveryAt).toISOString(),
  });
  if (error) throw error;
  return deliveryEta;
}

async function cancelRemoteOrder(id: string, reason: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc("secure_cancel_order", {
    p_order_id: id,
    p_reason: reason,
  });
  if (error) throw error;
}

async function completeRemoteDelivery(id: string, deliveryCode: string) {
  if (!supabase) return undefined;
  const { data, error } = await supabase.rpc("secure_complete_order", {
    p_order_id: id,
    p_delivery_code: deliveryCode,
  });
  if (error) throw error;
  const result = data as { receiptCode?: string } | null;
  return result?.receiptCode;
}

async function complainRemoteOrder(id: string, complaint: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc("secure_open_order_complaint", {
    p_order_id: id,
    p_complaint: complaint,
  });
  if (error) throw error;
}

export function useOrders() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [orders, setOrders] = useState<SavedOrder[]>(() =>
    supabase
      ? []
      : readOrders().map((order) => ({ ...order, status: normalizeStatus(order.status) })),
  );

  useEffect(() => {
    if (supabase && isSupabaseConfigured) return;
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }, [isSupabaseConfigured, orders]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !profile) return;
    let active = true;

    loadRemoteOrders(profile.id, profile.tipo)
      .then((remoteOrders) => {
        if (active && remoteOrders) setOrders(remoteOrders);
      })
      .catch((error) => {
        console.warn("Não foi possível carregar pedidos do Supabase.", error);
      });

    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile]);

  const addOrder = async (order: Omit<SavedOrder, "id" | "createdAt" | "status">) => {
    const buyerId = profile?.tipo === "comprador" ? await getBuyerId(profile.id) : undefined;
    const next: SavedOrder = {
      ...order,
      id: String(Math.floor(1000 + Math.random() * 9000)),
      createdAt: new Date().toISOString(),
      status: "Recebido",
      buyerId: buyerId ?? undefined,
      cancellationDeadline: addHours(new Date().toISOString(), CANCELLATION_LIMIT_HOURS),
      deliveryCode: generateDeliveryCode(),
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

  const confirmDelivery = async (id: string, deliveryAt: string) => {
    const deliveryEta =
      supabase && isSupabaseConfigured
        ? await confirmRemoteDelivery(id, deliveryAt)
        : formatDeliveryDateTime(deliveryAt);

    setOrders((current) =>
      current.map((order) =>
        order.id === id
          ? {
              ...order,
              status: "Em separação",
              deliveryAt: new Date(deliveryAt).toISOString(),
              deliveryEta: deliveryEta ?? formatDeliveryDateTime(deliveryAt),
              confirmedAt: new Date().toISOString(),
            }
          : order,
      ),
    );
  };

  const cancelOrder = async (id: string, actor: SavedOrder["canceledBy"], reason: string) => {
    const order = orders.find((item) => item.id === id);
    if (!order) throw new Error("Pedido não encontrado.");
    if (!canCancelOrder(order)) {
      throw new Error(
        "O prazo de cancelamento terminou. Abra uma reclamação ou fale com o suporte.",
      );
    }
    const cancellationReason = reason.trim() || "Cancelado pelo usuário.";
    if (supabase && isSupabaseConfigured) {
      await cancelRemoteOrder(id, cancellationReason);
    }
    setOrders((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Cancelado",
              canceledAt: new Date().toISOString(),
              canceledBy: actor,
              cancellationReason,
            }
          : item,
      ),
    );
  };

  const completeDelivery = async (id: string, code: string) => {
    const order = orders.find((item) => item.id === id);
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.deliveryCode && code.trim() !== order.deliveryCode) {
      throw new Error("Código de entrega incorreto.");
    }
    let receiptCode = order.receiptCode ?? generateReceiptCode();
    if (supabase && isSupabaseConfigured) {
      receiptCode = (await completeRemoteDelivery(id, code)) ?? receiptCode;
    }
    setOrders((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Entregue",
              deliveredAt: new Date().toISOString(),
              receiptCode,
            }
          : item,
      ),
    );
  };

  const openComplaint = async (id: string, complaint: string) => {
    const text = complaint.trim();
    if (!text) throw new Error("Descreva o problema antes de enviar.");
    if (supabase && isSupabaseConfigured) {
      await complainRemoteOrder(id, text);
    }
    setOrders((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              complaint: text,
              complaintStatus: "Aberta",
              complaintCreatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  return {
    orders,
    addOrder,
    updateStatus,
    confirmDelivery,
    cancelOrder,
    completeDelivery,
    openComplaint,
  };
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
