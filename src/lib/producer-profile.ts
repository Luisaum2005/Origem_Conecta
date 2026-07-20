import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type ProducerProfileDetails = {
  propertyName: string;
  responsibleName: string;
  cnpj: string;
  phone: string;
  location: string;
  products: string[];
  commercializationMode: "own" | "organization" | "undecided";
  commercialVerificationStatus: "self_declared" | "pending" | "verified" | "rejected";
  caepf: string;
  stateRegistration: string;
};

const PRODUCER_PROFILE_STORAGE_KEY = "origem-conecta-producer-profile";

const DEFAULT_PRODUCER_PROFILE: ProducerProfileDetails = {
  propertyName: "",
  responsibleName: "",
  cnpj: "",
  phone: "",
  location: "",
  products: [],
  commercializationMode: "undecided",
  commercialVerificationStatus: "self_declared",
  caepf: "",
  stateRegistration: "",
};

type RemoteProducerProfile = {
  nome: string | null;
  telefone: string | null;
  producers?:
    | {
        nome_propriedade?: string | null;
        responsavel?: string | null;
        cnpj?: string | null;
        localizacao?: string | null;
        categorias_atendidas?: string[] | null;
        commercialization_mode?: "own" | "organization" | "undecided" | null;
        commercial_verification_status?:
          | "self_declared"
          | "pending"
          | "verified"
          | "rejected"
          | null;
        producer_commercial_documents?: {
          cnpj?: string | null;
          caepf?: string | null;
          state_registration?: string | null;
        } | null;
      }
    | Array<{
        nome_propriedade?: string | null;
        responsavel?: string | null;
        cnpj?: string | null;
        localizacao?: string | null;
        categorias_atendidas?: string[] | null;
        commercialization_mode?: "own" | "organization" | "undecided" | null;
        commercial_verification_status?:
          | "self_declared"
          | "pending"
          | "verified"
          | "rejected"
          | null;
        producer_commercial_documents?: {
          cnpj?: string | null;
          caepf?: string | null;
          state_registration?: string | null;
        } | null;
      }>
    | null;
};

function readStoredProfile() {
  if (typeof window === "undefined") return DEFAULT_PRODUCER_PROFILE;
  const stored = window.localStorage.getItem(PRODUCER_PROFILE_STORAGE_KEY);
  if (!stored) return DEFAULT_PRODUCER_PROFILE;
  try {
    return { ...DEFAULT_PRODUCER_PROFILE, ...(JSON.parse(stored) as ProducerProfileDetails) };
  } catch {
    return DEFAULT_PRODUCER_PROFILE;
  }
}

function mapRemoteProfile(row: RemoteProducerProfile): ProducerProfileDetails {
  const producer = Array.isArray(row.producers) ? row.producers[0] : row.producers;
  const documents = producer?.producer_commercial_documents;
  return {
    propertyName: producer?.nome_propriedade || row.nome || DEFAULT_PRODUCER_PROFILE.propertyName,
    responsibleName: producer?.responsavel || row.nome || DEFAULT_PRODUCER_PROFILE.responsibleName,
    cnpj: documents?.cnpj || "",
    phone: row.telefone || "",
    location: producer?.localizacao || DEFAULT_PRODUCER_PROFILE.location,
    products: producer?.categorias_atendidas ?? [],
    commercializationMode: producer?.commercialization_mode ?? "undecided",
    commercialVerificationStatus: producer?.commercial_verification_status ?? "self_declared",
    caepf: documents?.caepf ?? "",
    stateRegistration: documents?.state_registration ?? "",
  };
}

async function loadRemoteProducerProfile(profileId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "nome,telefone,producers(nome_propriedade,responsavel,localizacao,categorias_atendidas,commercialization_mode,commercial_verification_status,producer_commercial_documents(cnpj,caepf,state_registration))",
    )
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRemoteProfile(data as RemoteProducerProfile) : null;
}

async function updateRemoteProducerProfile(profileId: string, details: ProducerProfileDetails) {
  if (!supabase) return;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      nome: details.responsibleName,
      telefone: details.phone || null,
    })
    .eq("id", profileId);
  if (profileError) throw profileError;

  const { error: producerError } = await supabase
    .from("producers")
    .update({
      nome_propriedade: details.propertyName,
      responsavel: details.responsibleName,
      localizacao: details.location || null,
      categorias_atendidas: details.products,
      commercialization_mode: details.commercializationMode,
    })
    .eq("profile_id", profileId);
  if (producerError) throw producerError;
  const { data: producerRow, error: producerIdError } = await supabase
    .from("producers")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (producerIdError) throw producerIdError;
  if (producerRow) {
    const { error: documentsError } = await supabase.from("producer_commercial_documents").upsert({
      producer_id: producerRow.id,
      cnpj: details.cnpj || null,
      caepf: details.caepf || null,
      state_registration: details.stateRegistration || null,
      updated_at: new Date().toISOString(),
    });
    if (documentsError) throw documentsError;
  }
}

export function useProducerProfileDetails() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [details, setDetails] = useState<ProducerProfileDetails>(readStoredProfile);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(PRODUCER_PROFILE_STORAGE_KEY, JSON.stringify(details));
  }, [details]);

  useEffect(() => {
    if (profile?.tipo !== "produtor") return;

    if (!supabase || !isSupabaseConfigured) {
      // Local/mock mode: load signup details from local storage
      try {
        const detailsJson = window.localStorage.getItem(
          `origem-conecta-local-producer-${profile.id}`,
        );
        if (detailsJson) {
          const localDetails = JSON.parse(detailsJson);
          setDetails({
            propertyName: localDetails.nome_propriedade || "",
            responsibleName: localDetails.responsavel || profile.nome || "",
            cnpj: localDetails.cnpj || "",
            phone: profile.telefone || "",
            location: localDetails.localizacao || "",
            products: localDetails.produtos || [],
            commercializationMode: localDetails.commercialization_mode || "undecided",
            commercialVerificationStatus: "self_declared",
            caepf: localDetails.caepf || "",
            stateRegistration: localDetails.state_registration || "",
          });
        }
      } catch (e) {
        console.error(e);
      }
      return;
    }

    let active = true;
    loadRemoteProducerProfile(profile.id)
      .then((remoteDetails) => {
        if (active && remoteDetails) setDetails(remoteDetails);
      })
      .catch((error) => {
        console.warn("Nao foi possivel carregar o perfil do produtor.", error);
      });

    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile?.id, profile?.tipo, profile?.nome, profile?.telefone]);

  const saveDetails = async (nextDetails: ProducerProfileDetails) => {
    setSaving(true);
    try {
      if (supabase && isSupabaseConfigured && profile?.tipo === "produtor") {
        await updateRemoteProducerProfile(profile.id, nextDetails);
      } else if (profile?.tipo === "produtor") {
        window.localStorage.setItem(
          `origem-conecta-local-producer-${profile.id}`,
          JSON.stringify({
            nome_propriedade: nextDetails.propertyName,
            responsavel: nextDetails.responsibleName,
            cnpj: nextDetails.cnpj,
            localizacao: nextDetails.location,
            produtos: nextDetails.products,
            commercialization_mode: nextDetails.commercializationMode,
            caepf: nextDetails.caepf,
            state_registration: nextDetails.stateRegistration,
          }),
        );
      }
      setDetails(nextDetails);
    } finally {
      setSaving(false);
    }
  };

  return { details, saveDetails, saving };
}
