import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { toast } from "sonner";

export type StockStatus = "ativo" | "pausado";

export type ProducerStockItem = {
  id: string;
  producerId?: string;
  producerName?: string;
  producerLocation?: string;
  producerResponsible?: string;
  imageUrl?: string;
  videoUrl?: string;
  product: string;
  quantity: string;
  unit: string;
  price: string;
  harvestDate: string;
  expiryDate: string;
  notes: string;
  status: StockStatus;
};

export type StockDecrementItem = {
  productId: string;
  quantity: number;
};

type InventoryRow = {
  id: string;
  producer_id: string | null;
  nome_produto: string | null;
  unidade: string | null;
  quantidade_disponivel: number | string | null;
  preco: number | string | null;
  data_colheita: string | null;
  validade: string | null;
  observacoes: string | null;
  imagem_url: string | null;
  video_url?: string | null;
  ativo: boolean | null;
  products?: {
    nome?: string | null;
    unidade?: string | null;
  } | null;
  producers?: {
    nome_propriedade?: string | null;
    localizacao?: string | null;
    responsavel?: string | null;
  } | null;
};

export const PRODUCER_STOCK_STORAGE_KEY = "origem-conecta-producer-stock";

export const EMPTY_STOCK_ITEM: ProducerStockItem = {
  id: "",
  product: "",
  quantity: "",
  unit: "kg",
  price: "",
  harvestDate: "",
  expiryDate: "",
  notes: "",
  status: "ativo",
};

export const INITIAL_PRODUCER_STOCK: ProducerStockItem[] = [];

function readStoredStock() {
  if (supabase) return [];
  if (typeof window === "undefined") return INITIAL_PRODUCER_STOCK;
  const stored = window.localStorage.getItem(PRODUCER_STOCK_STORAGE_KEY);
  if (!stored) return INITIAL_PRODUCER_STOCK;
  try {
    return JSON.parse(stored) as ProducerStockItem[];
  } catch {
    return INITIAL_PRODUCER_STOCK;
  }
}

function normalizeDecrementItems(items: StockDecrementItem[]) {
  return items
    .map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => item.productId && item.quantity > 0);
}

function applyStockDecrement(stock: ProducerStockItem[], items: StockDecrementItem[]) {
  const decrements = normalizeDecrementItems(items);
  if (!decrements.length) return stock;

  return stock.map((stockItem) => {
    const decrement = decrements.find((item) => item.productId === stockItem.id);
    if (!decrement) return stockItem;

    const nextQuantity = Math.max(0, Number(stockItem.quantity || 0) - decrement.quantity);
    return {
      ...stockItem,
      quantity: String(nextQuantity),
    };
  });
}

function mapInventoryRow(row: InventoryRow): ProducerStockItem {
  return {
    id: row.id,
    producerId: row.producer_id ?? undefined,
    producerName: row.producers?.nome_propriedade ?? undefined,
    producerLocation: row.producers?.localizacao ?? undefined,
    producerResponsible: row.producers?.responsavel ?? undefined,
    imageUrl: row.imagem_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    product: row.nome_produto || row.products?.nome || "Produto sem nome",
    quantity: String(row.quantidade_disponivel ?? ""),
    unit: row.unidade || row.products?.unidade || "kg",
    price: String(row.preco ?? ""),
    harvestDate: row.data_colheita ?? "",
    expiryDate: row.validade ?? "",
    notes: row.observacoes ?? "",
    status: row.ativo === false ? "pausado" : "ativo",
  };
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

async function loadInventory(producerId?: string | null) {
  if (!supabase) return null;
  let query = supabase
    .from("producer_inventory")
    .select(
      "id,producer_id,nome_produto,unidade,quantidade_disponivel,preco,data_colheita,validade,observacoes,imagem_url,video_url,ativo,products(nome,unidade),producers(nome_propriedade,localizacao,responsavel)",
    )
    .order("atualizado_em", { ascending: false });

  if (producerId) {
    query = query.eq("producer_id", producerId);
  } else {
    query = query.eq("ativo", true);
  }

  const { data, error } = await query;
  if (error) {
    let fallbackQuery = supabase
      .from("producer_inventory")
      .select(
        "id,producer_id,nome_produto,unidade,quantidade_disponivel,preco,data_colheita,validade,observacoes,imagem_url,ativo",
      )
      .order("atualizado_em", { ascending: false });

    if (producerId) {
      fallbackQuery = fallbackQuery.eq("producer_id", producerId);
    } else {
      fallbackQuery = fallbackQuery.eq("ativo", true);
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) throw fallbackError;
    return (fallbackData ?? []).map((row) => mapInventoryRow(row as InventoryRow));
  }
  return (data ?? []).map((row) => mapInventoryRow(row as InventoryRow));
}

async function syncProducerInventory(producerId: string, items: ProducerStockItem[]) {
  if (!supabase) return;

  const { data: currentRows, error: currentError } = await supabase
    .from("producer_inventory")
    .select("id")
    .eq("producer_id", producerId);
  if (currentError) throw currentError;

  const nextIds = new Set(items.map((item) => item.id).filter(Boolean));
  const removedIds = (currentRows ?? [])
    .map((row) => row.id as string)
    .filter((id) => !nextIds.has(id));

  if (removedIds.length) {
    const { error: deleteError } = await supabase
      .from("producer_inventory")
      .delete()
      .in("id", removedIds);
    if (deleteError) throw deleteError;
  }

  if (!items.length) return;

  const payload = items.map((item) => ({
    id: item.id,
    producer_id: producerId,
    nome_produto: item.product,
    unidade: item.unit,
    quantidade_disponivel: Number(String(item.quantity || 0).replace(",", ".")) || 0,
    preco: Number(String(item.price || 0).replace(",", ".")) || 0,
    data_colheita: item.harvestDate || null,
    validade: item.expiryDate || null,
    observacoes: item.notes || null,
    imagem_url: item.imageUrl || null,
    video_url: item.videoUrl || null,
    ativo: item.status === "ativo",
    atualizado_em: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("producer_inventory")
    .upsert(payload, { onConflict: "id" });
  if (upsertError) throw upsertError;
}

async function decrementRemoteInventory(items: StockDecrementItem[]) {
  if (!supabase) return;
  const payload = normalizeDecrementItems(items);
  if (!payload.length) return;

  const { error } = await supabase.rpc("decrement_inventory_for_order", { p_items: payload });
  if (error) throw error;
}

function extensionFromFile(file: File) {
  const explicit = file.name.split(".").pop()?.toLowerCase();
  if (explicit && ["jpg", "jpeg", "png", "webp", "mp4", "webm", "mov"].includes(explicit)) {
    return explicit;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "video/webm") return "webm";
  if (file.type === "video/quicktime") return "mov";
  if (file.type === "video/mp4") return "mp4";
  return "jpg";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useProducerStock() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [items, setItemsState] = useState<ProducerStockItem[]>(readStoredStock);
  const [producerId, setProducerId] = useState<string | null>(null);
  const remoteLoadedRef = useRef(false);
  const lastSyncedRef = useRef("");

  useEffect(() => {
    window.localStorage.setItem(PRODUCER_STOCK_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    let active = true;

    async function loadRemoteStock() {
      try {
        const nextProducerId =
          profile?.tipo === "produtor" ? await getProducerId(profile.id) : null;
        if (profile?.tipo === "produtor" && !nextProducerId) {
          toast.error(
            "Erro: Seu perfil de produtor não foi encontrado nas tabelas do Supabase. Verifique o cadastro.",
          );
        }
        const remoteItems = await loadInventory(nextProducerId);
        if (!active || !remoteItems) return;
        setProducerId(nextProducerId);
        setItemsState(remoteItems.length ? remoteItems : profile?.tipo ? [] : readStoredStock());
        lastSyncedRef.current = JSON.stringify(remoteItems);
        remoteLoadedRef.current = true;
      } catch (error: any) {
        console.warn("Nao foi possivel carregar o estoque do Supabase.", error);
        toast.error(`Erro ao carregar estoque do Supabase: ${error?.message || error}`);
        remoteLoadedRef.current = false;
      }
    }

    loadRemoteStock();

    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile?.id, profile?.tipo]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !producerId || !remoteLoadedRef.current) return;
    const serialized = JSON.stringify(items);
    if (serialized === lastSyncedRef.current) return;

    lastSyncedRef.current = serialized;
    syncProducerInventory(producerId, items).catch((error: any) => {
      console.warn("Nao foi possivel sincronizar o estoque com o Supabase.", error);
      toast.error(`Erro ao salvar estoque no Supabase: ${error?.message || error}`);
    });
  }, [isSupabaseConfigured, items, producerId]);

  const setItems = useCallback((next: SetStateAction<ProducerStockItem[]>) => {
    setItemsState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;

      let localProducerDetails: {
        nome_propriedade: string;
        localizacao: string;
        responsavel: string;
      } | null = null;
      if (!supabase && typeof window !== "undefined") {
        try {
          const profileJson = window.localStorage.getItem("origem-conecta-auth-profile");
          if (profileJson) {
            const prof = JSON.parse(profileJson);
            const detailsJson = window.localStorage.getItem(
              `origem-conecta-local-producer-${prof.id}`,
            );
            if (detailsJson) {
              localProducerDetails = JSON.parse(detailsJson);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      return resolved.map((item) => {
        const id = item.id || crypto.randomUUID();
        if (!item.producerName && localProducerDetails) {
          return {
            ...item,
            id,
            producerName: localProducerDetails.nome_propriedade,
            producerLocation: localProducerDetails.localizacao,
            producerResponsible: localProducerDetails.responsavel,
          };
        }
        return {
          ...item,
          id,
        };
      });
    });
  }, []);

  const uploadMedia = useCallback(
    async (file: File, itemId: string, mediaType: "image" | "video" = "image") => {
      const expectedPrefix = mediaType === "image" ? "image/" : "video/";
      if (!file.type.startsWith(expectedPrefix)) {
        throw new Error(
          mediaType === "image" ? "Selecione um arquivo de imagem." : "Selecione um vídeo.",
        );
      }
      const maxSize = mediaType === "image" ? 5 * 1024 * 1024 : 30 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error(
          mediaType === "image" ? "A imagem deve ter até 5 MB." : "O vídeo deve ter até 30 MB.",
        );
      }

      if (!supabase || !isSupabaseConfigured || !producerId) {
        return readFileAsDataUrl(file);
      }

      const folder = mediaType === "image" ? "photos" : "videos";
      const path = `${producerId}/${folder}/${itemId}-${Date.now()}.${extensionFromFile(file)}`;
      const { error } = await supabase.storage.from("product-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw error;

      const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
      return data.publicUrl;
    },
    [isSupabaseConfigured, producerId],
  );

  const decrementStock = useCallback(
    async (orderItems: StockDecrementItem[]) => {
      const normalized = normalizeDecrementItems(orderItems);
      if (!normalized.length) return;

      if (supabase && isSupabaseConfigured) {
        await decrementRemoteInventory(normalized);
      }

      setItemsState((current) => applyStockDecrement(current, normalized));
    },
    [isSupabaseConfigured],
  );

  return [
    items,
    setItems,
    {
      uploadImage: (file: File, itemId: string) => uploadMedia(file, itemId, "image"),
      uploadVideo: (file: File, itemId: string) => uploadMedia(file, itemId, "video"),
      canUploadRemoteImage: Boolean(producerId),
      decrementStock,
    },
  ] as const;
}
