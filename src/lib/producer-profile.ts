import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";

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
  postalCode: string;
  addressLine: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export function hasMissingProducerProducts(details: Pick<ProducerProfileDetails, "products">) {
  return details.products.length === 0;
}

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
  postalCode: "",
  addressLine: "",
  addressNumber: "",
  addressComplement: "",
  neighborhood: "",
  city: "",
  state: "",
};

type RemoteProducerProfile = {
  profile_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  property_name: string | null;
  responsible_name: string | null;
  location: string | null;
  postal_code: string | null;
  address_line: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  products: string[] | null;
  commercialization_mode: "own" | "organization" | "undecided" | null;
  commercial_verification_status: "self_declared" | "pending" | "verified" | "rejected" | null;
  cnpj: string | null;
  caepf: string | null;
  state_registration: string | null;
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
  return {
    propertyName: row.property_name || row.profile_name || DEFAULT_PRODUCER_PROFILE.propertyName,
    responsibleName:
      row.responsible_name || row.profile_name || DEFAULT_PRODUCER_PROFILE.responsibleName,
    cnpj: row.cnpj || "",
    phone: row.phone || "",
    location: row.location || DEFAULT_PRODUCER_PROFILE.location,
    products: row.products ?? [],
    commercializationMode: row.commercialization_mode ?? "undecided",
    commercialVerificationStatus: row.commercial_verification_status ?? "self_declared",
    caepf: row.caepf ?? "",
    stateRegistration: row.state_registration ?? "",
    postalCode: row.postal_code ?? "",
    addressLine: row.address_line ?? "",
    addressNumber: row.address_number ?? "",
    addressComplement: row.address_complement ?? "",
    neighborhood: row.neighborhood ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
  };
}

async function loadRemoteProducerProfile() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_my_producer_profile").maybeSingle();
  if (error) throw error;
  return data ? mapRemoteProfile(data as RemoteProducerProfile) : null;
}

async function updateRemoteProducerProfile(details: ProducerProfileDetails) {
  if (!supabase) return;
  const { error } = await supabase.rpc("secure_update_my_producer_profile", {
    p_details: {
      propertyName: details.propertyName,
      responsibleName: details.responsibleName,
      phone: details.phone,
      city: details.city,
      state: details.state,
      postalCode: details.postalCode,
      addressLine: details.addressLine,
      addressNumber: details.addressNumber,
      addressComplement: details.addressComplement,
      neighborhood: details.neighborhood,
      products: details.products,
      commercializationMode: details.commercializationMode,
      cnpj: details.cnpj,
      caepf: details.caepf,
      stateRegistration: details.stateRegistration,
    },
  });
  if (error) throw error;
}

export function useProducerProfileDetails() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [details, setDetails] = useState<ProducerProfileDetails>(() =>
    supabase ? DEFAULT_PRODUCER_PROFILE : readStoredProfile(),
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (supabase && isSupabaseConfigured) return;
    window.localStorage.setItem(PRODUCER_PROFILE_STORAGE_KEY, JSON.stringify(details));
  }, [details, isSupabaseConfigured]);

  useEffect(() => {
    if (profile?.tipo !== "produtor") return;

    if (!supabase || !isSupabaseConfigured) {
      setLoading(false);
      setError("");
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
            postalCode: localDetails.postal_code || "",
            addressLine: localDetails.address_line || "",
            addressNumber: localDetails.address_number || "",
            addressComplement: localDetails.address_complement || "",
            neighborhood: localDetails.neighborhood || "",
            city: localDetails.cidade || "",
            state: localDetails.estado || "",
          });
        }
      } catch (e) {
        console.error(e);
      }
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    loadRemoteProducerProfile()
      .then((remoteDetails) => {
        if (active && remoteDetails) setDetails(remoteDetails);
      })
      .catch((loadError) => {
        if (!active) return;
        console.warn("Nao foi possivel carregar o perfil do produtor.", loadError);
        setError("N\u00e3o conseguimos carregar os dados da sua propriedade agora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    isSupabaseConfigured,
    profile?.id,
    profile?.tipo,
    profile?.nome,
    profile?.telefone,
    reloadVersion,
  ]);

  const saveDetails = (nextDetails: ProducerProfileDetails) => {
    if (savePromiseRef.current) return savePromiseRef.current;
    setSaving(true);
    const promise = (async () => {
      if (supabase && isSupabaseConfigured && profile?.tipo === "produtor") {
        await updateRemoteProducerProfile(nextDetails);
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
            postal_code: nextDetails.postalCode,
            address_line: nextDetails.addressLine,
            address_number: nextDetails.addressNumber,
            address_complement: nextDetails.addressComplement,
            neighborhood: nextDetails.neighborhood,
            cidade: nextDetails.city,
            estado: nextDetails.state,
          }),
        );
      }
      setDetails(nextDetails);
    })().finally(() => {
      savePromiseRef.current = null;
      setSaving(false);
    });
    savePromiseRef.current = promise;
    return promise;
  };

  return {
    details,
    saveDetails,
    saving,
    loading,
    error,
    reload: () => setReloadVersion((current) => current + 1),
  };
}
