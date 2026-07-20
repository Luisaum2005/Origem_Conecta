import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type QuoteStatus = "Aberta" | "Respondida" | "Aprovada" | "Recusada";

export type QuoteRequest = {
  id: string;
  createdAt: string;
  buyerName: string;
  productName: string;
  quantity: string;
  unit: string;
  deliveryDate: string;
  notes: string;
  status: QuoteStatus;
  targetPrice?: string;
  producerName?: string;
  responsePrice?: string;
  responseNotes?: string;
  createdOrderId?: string;
};

type RemoteQuoteStatus = "aberta" | "respondida" | "aprovada" | "recusada";

type RemoteQuoteRequest = {
  id: string;
  criado_em: string;
  buyer_id?: string;
  producer_id?: string | null;
  nome_produto: string;
  quantidade: number | string;
  unidade: string;
  entrega_desejada: string | null;
  preco_alvo: number | string | null;
  observacoes: string | null;
  status: RemoteQuoteStatus;
  preco_resposta: number | string | null;
  observacoes_resposta: string | null;
  buyers?: {
    nome_empresa?: string | null;
  } | null;
  producers?: {
    nome_propriedade?: string | null;
    responsavel?: string | null;
  } | null;
  created_order?: { id: string }[] | null;
};

export const QUOTE_REQUESTS_STORAGE_KEY = "origem-conecta-quote-requests";

const appToDbStatus: Record<QuoteStatus, RemoteQuoteStatus> = {
  Aberta: "aberta",
  Respondida: "respondida",
  Aprovada: "aprovada",
  Recusada: "recusada",
};

const dbToAppStatus: Record<RemoteQuoteStatus, QuoteStatus> = {
  aberta: "Aberta",
  respondida: "Respondida",
  aprovada: "Aprovada",
  recusada: "Recusada",
};

function readQuoteRequests() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(QUOTE_REQUESTS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as QuoteRequest[];
  } catch {
    return [];
  }
}

function mapRemoteQuote(row: RemoteQuoteRequest): QuoteRequest {
  return {
    id: row.id,
    createdAt: row.criado_em,
    buyerName: row.buyers?.nome_empresa || "Comprador",
    productName: row.nome_produto,
    quantity: String(row.quantidade ?? ""),
    unit: row.unidade,
    deliveryDate: row.entrega_desejada ?? "",
    targetPrice: row.preco_alvo == null ? "" : String(row.preco_alvo),
    notes: row.observacoes ?? "",
    status: dbToAppStatus[row.status],
    producerName: row.producers?.nome_propriedade ?? undefined,
    responsePrice: row.preco_resposta == null ? "" : String(row.preco_resposta),
    responseNotes: row.observacoes_resposta ?? "",
    createdOrderId: row.created_order?.[0]?.id,
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

async function getProducerDetails(profileId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("producers")
    .select("id,nome_propriedade,responsavel")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function loadRemoteQuotes(
  profileId: string,
  profileType: "comprador" | "produtor" | "organizacao" | "admin",
) {
  if (!supabase) return null;
  if (profileType === "organizacao") return [];
  let query = supabase
    .from("quote_requests")
    .select(
      "id,criado_em,nome_produto,quantidade,unidade,entrega_desejada,preco_alvo,observacoes,status,preco_resposta,observacoes_resposta,buyers(nome_empresa),producers(nome_propriedade,responsavel),created_order:orders(id)",
    )
    .order("criado_em", { ascending: false });

  if (profileType === "comprador") {
    const buyerId = await getBuyerId(profileId);
    if (!buyerId) return [];
    query = query.eq("buyer_id", buyerId);
  }

  if (profileType === "produtor") {
    const producerId = await getProducerId(profileId);
    if (!producerId) return [];
    query = query.or(`status.eq.aberta,producer_id.eq.${producerId}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapRemoteQuote(row as RemoteQuoteRequest));
}

async function createRemoteQuote(profileId: string, quote: QuoteRequest) {
  if (!supabase) return null;
  const buyerId = await getBuyerId(profileId);
  if (!buyerId) {
    throw new Error("Cadastro de comprador nao encontrado para este usuario.");
  }

  const { data, error } = await supabase
    .from("quote_requests")
    .insert({
      buyer_id: buyerId,
      nome_produto: quote.productName,
      quantidade: Number(quote.quantity || 0),
      unidade: quote.unit,
      entrega_desejada: quote.deliveryDate || null,
      preco_alvo: quote.targetPrice ? Number(String(quote.targetPrice).replace(",", ".")) : null,
      observacoes: quote.notes || null,
      status: appToDbStatus[quote.status],
    })
    .select("id,criado_em")
    .single();
  if (error) throw error;

  return { id: data.id as string, createdAt: data.criado_em as string };
}

async function respondRemoteQuote(
  profileId: string,
  id: string,
  response: Pick<QuoteRequest, "producerName" | "responsePrice" | "responseNotes">,
) {
  if (!supabase) return;
  const producer = await getProducerDetails(profileId);
  if (!producer?.id) {
    throw new Error("Cadastro de produtor nao encontrado para este usuario.");
  }

  const price = response.responsePrice
    ? Number(String(response.responsePrice).replace(",", "."))
    : null;
  if (!price || price <= 0) {
    throw new Error("Informe um preço válido para aceitar a solicitação.");
  }

  const { data, error } = await supabase
    .from("quote_requests")
    .update({
      producer_id: producer.id,
      preco_resposta: price,
      observacoes_resposta: response.responseNotes || null,
      status: "respondida",
      respondido_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "aberta")
    .is("producer_id", null)
    .select(
      "id,buyer_id,nome_produto,quantidade,unidade,entrega_desejada,observacoes,buyers(nome_empresa)",
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Esta cotacao ja foi respondida por outro produtor.");
  }

  const quantity = Number(data.quantidade || 0);
  const subtotal = quantity * price;
  const producerName =
    response.producerName || producer.nome_propriedade || producer.responsavel || "Produtor";
  const buyerRelation = Array.isArray(data.buyers) ? data.buyers[0] : data.buyers;
  const deliveryLabel = data.entrega_desejada
    ? `Solicitado para ${new Date(`${data.entrega_desejada}T12:00:00`).toLocaleDateString("pt-BR")}`
    : "Aguardando data e hora do produtor";

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: data.buyer_id,
      buyer_name: buyerRelation?.nome_empresa || "Comprador",
      status: "recebido",
      subtotal,
      delivery: 0,
      total: subtotal,
      entrega_label: deliveryLabel,
      origem_solicitacao_id: data.id,
    })
    .select("id")
    .single();
  if (orderError) throw orderError;

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_ref: data.nome_produto,
    product_name: data.nome_produto,
    quantidade: quantity,
    unidade: data.unidade,
    preco_unitario: price,
    producer_id: producer.id,
    producer_ref: producer.id,
    producer_name: producerName,
    escolha_manual_produtor: true,
    line_total: subtotal,
    observacoes: [
      data.observacoes ? `Solicitação: ${data.observacoes}` : "",
      response.responseNotes ? `Resposta do produtor: ${response.responseNotes}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  });
  if (itemError) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw itemError;
  }

  return order.id as string;
}

async function updateRemoteQuoteStatus(id: string, status: QuoteStatus) {
  if (!supabase) return;
  const { error } = await supabase
    .from("quote_requests")
    .update({ status: appToDbStatus[status] })
    .eq("id", id);
  if (error) throw error;
}

export function useQuoteRequests() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [quotes, setQuotes] = useState<QuoteRequest[]>(readQuoteRequests);

  useEffect(() => {
    window.localStorage.setItem(QUOTE_REQUESTS_STORAGE_KEY, JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !profile) return;
    let active = true;

    loadRemoteQuotes(profile.id, profile.tipo)
      .then((remoteQuotes) => {
        if (active && remoteQuotes) setQuotes(remoteQuotes);
      })
      .catch((error) => {
        console.warn("Nao foi possivel carregar cotacoes do Supabase.", error);
      });

    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile]);

  const addQuote = async (quote: Omit<QuoteRequest, "id" | "createdAt" | "status">) => {
    const next: QuoteRequest = {
      ...quote,
      id: String(Math.floor(1000 + Math.random() * 9000)),
      createdAt: new Date().toISOString(),
      status: "Aberta",
    };

    if (supabase && isSupabaseConfigured && profile?.tipo === "comprador") {
      const remote = await createRemoteQuote(profile.id, next);
      const savedQuote = remote ? { ...next, id: remote.id, createdAt: remote.createdAt } : next;
      setQuotes((current) => [savedQuote, ...current]);
      return savedQuote;
    }

    setQuotes((current) => [next, ...current]);
    return next;
  };

  const respondQuote = async (
    id: string,
    response: Pick<QuoteRequest, "producerName" | "responsePrice" | "responseNotes">,
  ) => {
    if (supabase && isSupabaseConfigured && profile?.tipo === "produtor") {
      const createdOrderId = await respondRemoteQuote(profile.id, id, response);
      setQuotes((current) =>
        current.map((quote) =>
          quote.id === id
            ? {
                ...quote,
                ...response,
                status: "Respondida",
                createdOrderId,
              }
            : quote,
        ),
      );
      return;
    }

    setQuotes((current) =>
      current.map((quote) =>
        quote.id === id
          ? {
              ...quote,
              ...response,
              status: "Respondida",
            }
          : quote,
      ),
    );
  };

  const updateStatus = async (id: string, status: QuoteStatus) => {
    if (supabase && isSupabaseConfigured && profile?.tipo !== "produtor") {
      await updateRemoteQuoteStatus(id, status);
    }
    setQuotes((current) =>
      current.map((quote) => (quote.id === id ? { ...quote, status } : quote)),
    );
  };

  return { quotes, addQuote, respondQuote, updateStatus };
}
