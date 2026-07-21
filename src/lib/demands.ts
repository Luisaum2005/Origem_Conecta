import { useAuth } from "@/lib/auth";
import type { PaymentMethod } from "@/lib/orders";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type DemandUrgency = "normal" | "urgente";
export type DemandStatus = "Aberta" | "Respondida" | "Aprovada" | "Cancelada";
export type DemandResponseStatus = "Enviada" | "Aprovada" | "Recusada";

export type DemandItem = {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  productState: string;
  notes?: string;
};

export type DemandResponseItem = {
  id: string;
  demandItemId?: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
  canSupply: boolean;
  notes?: string;
};

export type DemandResponse = {
  id: string;
  demandId: string;
  producerId?: string;
  producerName: string;
  status: DemandResponseStatus;
  notes?: string;
  orderId?: string;
  createdAt: string;
  items: DemandResponseItem[];
};

export type DemandRequest = {
  id: string;
  createdAt: string;
  buyerId?: string;
  buyerName: string;
  deliveryDate: string;
  urgency: DemandUrgency;
  status: DemandStatus;
  paymentMethod?: PaymentMethod;
  paymentNotes?: string;
  notes?: string;
  items: DemandItem[];
  responses: DemandResponse[];
};

export type NewDemandInput = Omit<DemandRequest, "id" | "createdAt" | "status" | "responses">;
export type NewDemandResponseInput = Omit<
  DemandResponse,
  "id" | "demandId" | "createdAt" | "status" | "orderId"
>;

const DEMANDS_STORAGE_KEY = "origem-conecta-demands";

function readDemands() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMANDS_STORAGE_KEY) || "[]") as DemandRequest[];
  } catch {
    return [];
  }
}

function toDbStatus(status: DemandStatus) {
  return status.toLowerCase();
}

function fromDbStatus(status?: string | null): DemandStatus {
  if (status === "aprovada") return "Aprovada";
  if (status === "respondida") return "Respondida";
  if (status === "cancelada") return "Cancelada";
  return "Aberta";
}

function fromResponseStatus(status?: string | null): DemandResponseStatus {
  if (status === "aprovada") return "Aprovada";
  if (status === "recusada") return "Recusada";
  return "Enviada";
}

function toResponseStatus(status: DemandResponseStatus) {
  return status.toLowerCase();
}

function normalizeUrgency(value?: string | null): DemandUrgency {
  return value === "urgente" ? "urgente" : "normal";
}

type DemandItemRow = {
  id: string;
  product_name: string;
  quantity: number | string | null;
  unit: string;
  product_state: string;
  notes: string | null;
};

type DemandResponseItemRow = {
  id: string;
  demand_item_id: string | null;
  product_name: string;
  quantity: number | string | null;
  unit: string;
  price: number | string | null;
  can_supply: boolean | null;
  notes: string | null;
};

type DemandResponseRow = {
  id: string;
  demand_id: string;
  producer_id: string | null;
  producer_name: string;
  status: string | null;
  notes: string | null;
  order_id: string | null;
  created_at: string;
  demand_response_items?: DemandResponseItemRow[] | null;
};

type DemandRow = {
  id: string;
  created_at: string;
  buyer_id: string | null;
  buyer_name: string | null;
  delivery_date: string;
  urgency: string | null;
  status: string | null;
  payment_method: PaymentMethod | null;
  payment_notes: string | null;
  notes: string | null;
  demand_items?: DemandItemRow[] | null;
  demand_responses?: DemandResponseRow[] | null;
};

function mapDemand(row: DemandRow): DemandRequest {
  return {
    id: row.id,
    createdAt: row.created_at,
    buyerId: row.buyer_id ?? undefined,
    buyerName: row.buyer_name ?? "Comprador",
    deliveryDate: row.delivery_date,
    urgency: normalizeUrgency(row.urgency),
    status: fromDbStatus(row.status),
    paymentMethod: row.payment_method ?? undefined,
    paymentNotes: row.payment_notes ?? undefined,
    notes: row.notes ?? undefined,
    items: (row.demand_items ?? []).map((item) => ({
      id: item.id,
      productName: item.product_name,
      quantity: Number(item.quantity || 0),
      unit: item.unit,
      productState: item.product_state,
      notes: item.notes ?? undefined,
    })),
    responses: (row.demand_responses ?? []).map((response) => ({
      id: response.id,
      demandId: response.demand_id,
      producerId: response.producer_id ?? undefined,
      producerName: response.producer_name,
      status: fromResponseStatus(response.status),
      notes: response.notes ?? undefined,
      orderId: response.order_id ?? undefined,
      createdAt: response.created_at,
      items: (response.demand_response_items ?? []).map((item) => ({
        id: item.id,
        demandItemId: item.demand_item_id ?? undefined,
        productName: item.product_name,
        quantity: Number(item.quantity || 0),
        unit: item.unit,
        price: Number(item.price || 0),
        canSupply: Boolean(item.can_supply),
        notes: item.notes ?? undefined,
      })),
    })),
  };
}

async function getBuyer(profileId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("buyers")
    .select("id,nome_empresa")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getProducer(profileId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("producers")
    .select("id,nome_propriedade,responsavel")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadRemoteDemands(
  profileId: string,
  profileType: "comprador" | "produtor" | "organizacao" | "admin",
) {
  if (!supabase) return null;
  if (profileType === "organizacao") return [];
  const select =
    "id,buyer_id,buyer_name,delivery_date,urgency,status,payment_method,payment_notes,notes,created_at,demand_items(id,product_name,quantity,unit,product_state,notes),demand_responses(id,demand_id,producer_id,producer_name,status,notes,order_id,created_at,demand_response_items(id,demand_item_id,product_name,quantity,unit,price,can_supply,notes))";

  let query = supabase
    .from("demand_requests")
    .select(select)
    .order("created_at", { ascending: false });

  if (profileType === "comprador") {
    const buyer = await getBuyer(profileId);
    if (!buyer) return [];
    query = query.eq("buyer_id", buyer.id);
  } else if (profileType === "produtor") {
    query = query.in("status", ["aberta", "respondida"]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapDemand);
}

async function createRemoteDemand(profileId: string, profileName: string, input: NewDemandInput) {
  if (!supabase) return null;
  const buyer = await getBuyer(profileId);
  if (!buyer) throw new Error("Cadastro de comprador não encontrado.");

  const { data, error } = await supabase
    .from("demand_requests")
    .insert({
      buyer_id: buyer.id,
      buyer_name: input.buyerName || buyer.nome_empresa || profileName,
      delivery_date: input.deliveryDate,
      urgency: input.urgency,
      status: "aberta",
      payment_method: input.paymentMethod ?? "A combinar",
      payment_notes: input.paymentNotes ?? null,
      notes: input.notes ?? null,
    })
    .select("id,created_at")
    .single();
  if (error) throw error;

  const itemsPayload = input.items.map((item) => ({
    demand_id: data.id,
    product_name: item.productName,
    quantity: item.quantity,
    unit: item.unit,
    product_state: item.productState,
    notes: item.notes ?? null,
  }));

  if (itemsPayload.length) {
    const { error: itemsError } = await supabase.from("demand_items").insert(itemsPayload);
    if (itemsError) throw itemsError;
  }

  return { id: data.id as string, createdAt: data.created_at as string };
}

async function respondRemoteDemand(
  profileId: string,
  demandId: string,
  response: NewDemandResponseInput,
) {
  if (!supabase) return null;
  const producer = await getProducer(profileId);
  if (!producer) throw new Error("Cadastro de produtor não encontrado.");

  const { data, error } = await supabase
    .from("demand_responses")
    .insert({
      demand_id: demandId,
      producer_id: producer.id,
      producer_name: producer.responsavel || producer.nome_propriedade || response.producerName,
      status: "enviada",
      notes: response.notes ?? null,
    })
    .select("id,created_at")
    .single();
  if (error) throw error;

  const itemsPayload = response.items.map((item) => ({
    response_id: data.id,
    demand_item_id: item.demandItemId ?? null,
    product_name: item.productName,
    quantity: item.quantity,
    unit: item.unit,
    price: item.price,
    can_supply: item.canSupply,
    notes: item.notes ?? null,
  }));

  if (itemsPayload.length) {
    const { error: itemsError } = await supabase.from("demand_response_items").insert(itemsPayload);
    if (itemsError) throw itemsError;
  }

  await supabase.from("demand_requests").update({ status: "respondida" }).eq("id", demandId);
  return { id: data.id as string, createdAt: data.created_at as string };
}

async function approveRemoteResponse(
  profileId: string,
  demand: DemandRequest,
  response: DemandResponse,
) {
  if (!supabase) return null;
  const buyer = await getBuyer(profileId);
  if (!buyer) throw new Error("Cadastro de comprador não encontrado.");
  if (!response.producerId) throw new Error("Produtor da resposta não encontrado.");
  const { data, error } = await supabase.rpc("secure_accept_demand_response", {
    p_response_id: response.id,
  });
  if (error) throw error;
  if (!data) throw new Error("Não foi possível aceitar a resposta.");
  return data as string;
}

export function useDemandRequests() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [demands, setDemands] = useState<DemandRequest[]>(() => (supabase ? [] : readDemands()));

  useEffect(() => {
    if (supabase && isSupabaseConfigured) return;
    window.localStorage.setItem(DEMANDS_STORAGE_KEY, JSON.stringify(demands));
  }, [demands, isSupabaseConfigured]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !profile) return;
    let active = true;
    loadRemoteDemands(profile.id, profile.tipo)
      .then((remote) => {
        if (active && remote) setDemands(remote);
      })
      .catch((error) => console.warn("Não foi possível carregar demandas.", error));
    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile]);

  const addDemand = async (input: NewDemandInput) => {
    const next: DemandRequest = {
      ...input,
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      status: "Aberta",
      responses: [],
    };

    if (supabase && isSupabaseConfigured && profile?.tipo === "comprador") {
      const remote = await createRemoteDemand(profile.id, profile.nome, input);
      const saved = remote ? { ...next, id: remote.id, createdAt: remote.createdAt } : next;
      setDemands((current) => [saved, ...current]);
      return saved;
    }

    setDemands((current) => [next, ...current]);
    return next;
  };

  const respondDemand = async (demandId: string, response: NewDemandResponseInput) => {
    const localResponse: DemandResponse = {
      ...response,
      id: String(Date.now()),
      demandId,
      producerId: profile?.id || "produtor",
      status: "Enviada",
      createdAt: new Date().toISOString(),
    };

    if (supabase && isSupabaseConfigured && profile?.tipo === "produtor") {
      const remote = await respondRemoteDemand(profile.id, demandId, response);
      localResponse.id = remote?.id ?? localResponse.id;
      localResponse.createdAt = remote?.createdAt ?? localResponse.createdAt;
    }

    setDemands((current) =>
      current.map((demand) =>
        demand.id === demandId
          ? {
              ...demand,
              status: demand.status === "Aberta" ? "Respondida" : demand.status,
              responses: [localResponse, ...demand.responses],
            }
          : demand,
      ),
    );
    return localResponse;
  };

  const approveResponse = async (demandId: string, responseId: string) => {
    const demand = demands.find((item) => item.id === demandId);
    const response = demand?.responses.find((item) => item.id === responseId);
    if (!demand || !response) throw new Error("Resposta não encontrada.");

    let orderId: string | undefined;
    if (supabase && isSupabaseConfigured && profile?.tipo === "comprador") {
      const remoteOrderId = await approveRemoteResponse(profile.id, demand, response);
      orderId = remoteOrderId ?? undefined;
    } else {
      orderId = String(Date.now());
      try {
        const acceptedItems = response.items.filter((item) => item.canSupply);
        const subtotal = acceptedItems.reduce((sum, item) => sum + item.price, 0);
        const delivery = 35;
        const total = subtotal + delivery;
        const deliveryLabel = demand.deliveryDate
          ? new Date(`${demand.deliveryDate}T12:00:00`).toLocaleDateString("pt-BR")
          : "A combinar";

        const newOrder = {
          id: orderId,
          createdAt: new Date().toISOString(),
          buyerName: demand.buyerName,
          status: "Recebido",
          subtotal,
          delivery,
          total,
          deliveryEta: `Entrega solicitada para ${deliveryLabel}`,
          deliveryCode: String(Math.floor(1000 + Math.random() * 9000)),
          originQuoteId: demand.id,
          paymentMethod: demand.paymentMethod ?? "A combinar",
          paymentNotes: demand.paymentNotes ?? undefined,
          items: acceptedItems.map((item) => ({
            productId: item.demandItemId ?? item.productName,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.quantity > 0 ? item.price / item.quantity : item.price,
            producerId: response.producerId || "produtor",
            producerName: response.producerName,
            manualProducerChoice: true,
            lineTotal: item.price,
            notes: item.notes ?? undefined,
          })),
        };

        const existingOrdersStr = window.localStorage.getItem("origem-conecta-orders") || "[]";
        let existingOrders = [];
        try {
          existingOrders = JSON.parse(existingOrdersStr);
          if (!Array.isArray(existingOrders)) existingOrders = [];
        } catch {
          existingOrders = [];
        }
        window.localStorage.setItem(
          "origem-conecta-orders",
          JSON.stringify([newOrder, ...existingOrders]),
        );
      } catch (err) {
        console.warn("Erro ao salvar pedido mock no localStorage:", err);
      }
    }

    setDemands((current) =>
      current.map((item) =>
        item.id === demandId
          ? {
              ...item,
              status: "Aprovada",
              responses: item.responses.map((currentResponse) =>
                currentResponse.id === responseId
                  ? { ...currentResponse, status: "Aprovada", orderId }
                  : { ...currentResponse, status: "Recusada" },
              ),
            }
          : item,
      ),
    );
    return orderId;
  };

  return { demands, addDemand, respondDemand, approveResponse };
}
