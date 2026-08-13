import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type BuyerProfileDetails = {
  companyName: string;
  businessType: string;
  cnpj: string;
  responsibleName: string;
  phone: string;
  postalCode: string;
  addressLine: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
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
  postalCode: "",
  addressLine: "",
  addressNumber: "",
  addressComplement: "",
  neighborhood: "",
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
        postal_code?: string | null;
        address_line?: string | null;
        address_number?: string | null;
        address_complement?: string | null;
        neighborhood?: string | null;
      }
    | Array<{
        nome_empresa?: string | null;
        tipo_empresa?: string | null;
        cnpj?: string | null;
        postal_code?: string | null;
        address_line?: string | null;
        address_number?: string | null;
        address_complement?: string | null;
        neighborhood?: string | null;
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
    postalCode: buyer?.postal_code || "",
    addressLine: buyer?.address_line || "",
    addressNumber: buyer?.address_number || "",
    addressComplement: buyer?.address_complement || "",
    neighborhood: buyer?.neighborhood || "",
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
    .select(
      "nome,telefone,cidade,estado,buyers(nome_empresa,tipo_empresa,cnpj,postal_code,address_line,address_number,address_complement,neighborhood)",
    )
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
      postal_code: details.postalCode.replace(/\D/g, "") || null,
      address_line: details.addressLine || null,
      address_number: details.addressNumber || null,
      address_complement: details.addressComplement || null,
      neighborhood: details.neighborhood || null,
    })
    .eq("profile_id", profileId);
  if (buyerError) throw buyerError;
}

export function useBuyerProfileDetails() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [details, setDetails] = useState<BuyerProfileDetails>(() =>
    supabase ? DEFAULT_BUYER_PROFILE : readStoredProfile(),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (supabase && isSupabaseConfigured) return;
    window.localStorage.setItem(BUYER_PROFILE_STORAGE_KEY, JSON.stringify(details));
  }, [details, isSupabaseConfigured]);

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
