import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type BuyerProfileDetails = {
  companyName: string;
  businessType: string;
  cnpj: string;
  responsibleName: string;
  phone: string;
  city: string;
  state: string;
  currentSupplier: string;
  monthlySpend: string;
};

const BUYER_PROFILE_STORAGE_KEY = "origem-conecta-buyer-profile";

const DEFAULT_BUYER_PROFILE: BuyerProfileDetails = {
  companyName: "",
  businessType: "",
  cnpj: "",
  responsibleName: "",
  phone: "",
  city: "",
  state: "",
  currentSupplier: "",
  monthlySpend: "",
};

type RemoteBuyerProfile = {
  nome: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  buyers?:
    | {
        nome_empresa?: string | null;
        tipo_empresa?: string | null;
        cnpj?: string | null;
      }
    | Array<{
        nome_empresa?: string | null;
        tipo_empresa?: string | null;
        cnpj?: string | null;
      }>
    | null;
};

function readStoredProfile() {
  if (typeof window === "undefined") return DEFAULT_BUYER_PROFILE;
  const stored = window.localStorage.getItem(BUYER_PROFILE_STORAGE_KEY);
  if (!stored) return DEFAULT_BUYER_PROFILE;
  try {
    return { ...DEFAULT_BUYER_PROFILE, ...(JSON.parse(stored) as BuyerProfileDetails) };
  } catch {
    return DEFAULT_BUYER_PROFILE;
  }
}

function mapRemoteProfile(row: RemoteBuyerProfile): BuyerProfileDetails {
  const buyer = Array.isArray(row.buyers) ? row.buyers[0] : row.buyers;
  return {
    companyName: buyer?.nome_empresa || DEFAULT_BUYER_PROFILE.companyName,
    businessType: buyer?.tipo_empresa || DEFAULT_BUYER_PROFILE.businessType,
    cnpj: buyer?.cnpj || "",
    responsibleName: row.nome || DEFAULT_BUYER_PROFILE.responsibleName,
    phone: row.telefone || "",
    city: row.cidade || "",
    state: row.estado || "",
    currentSupplier: "",
    monthlySpend: "",
  };
}

async function loadRemoteBuyerProfile(profileId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("nome,telefone,cidade,estado,buyers(nome_empresa,tipo_empresa,cnpj)")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRemoteProfile(data as RemoteBuyerProfile) : null;
}

async function updateRemoteBuyerProfile(profileId: string, details: BuyerProfileDetails) {
  if (!supabase) return;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      nome: details.responsibleName,
      telefone: details.phone || null,
      cidade: details.city || null,
      estado: details.state || null,
    })
    .eq("id", profileId);
  if (profileError) throw profileError;

  const { error: buyerError } = await supabase
    .from("buyers")
    .update({
      nome_empresa: details.companyName,
      tipo_empresa: details.businessType,
      cnpj: details.cnpj || null,
    })
    .eq("profile_id", profileId);
  if (buyerError) throw buyerError;
}

export function useBuyerProfileDetails() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [details, setDetails] = useState<BuyerProfileDetails>(readStoredProfile);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(BUYER_PROFILE_STORAGE_KEY, JSON.stringify(details));
  }, [details]);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || profile?.tipo !== "comprador") return;
    let active = true;

    loadRemoteBuyerProfile(profile.id)
      .then((remoteDetails) => {
        if (active && remoteDetails) setDetails(remoteDetails);
      })
      .catch((error) => {
        console.warn("Nao foi possivel carregar o perfil do comprador.", error);
      });

    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile?.id, profile?.tipo]);

  const saveDetails = async (nextDetails: BuyerProfileDetails) => {
    setSaving(true);
    try {
      if (supabase && isSupabaseConfigured && profile?.tipo === "comprador") {
        await updateRemoteBuyerProfile(profile.id, nextDetails);
      }
      setDetails(nextDetails);
    } finally {
      setSaving(false);
    }
  };

  return { details, saveDetails, saving };
}
