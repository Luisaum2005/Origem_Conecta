import { assertSupabaseConfigured, supabase, throwSupabaseError } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type OrganizationStatus = "pending" | "active" | "rejected" | "suspended";
export type Organization = {
  id: string;
  type: "cooperativa" | "associacao";
  legalName: string;
  tradeName: string;
  cnpj: string;
  email: string;
  phone: string;
  addressLine: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  responsibleName: string;
  responsibleRole: string;
  status: OrganizationStatus;
  verificationStatus: "unverified" | "verified" | "failed";
  rejectionReason?: string;
  createdAt: string;
};

function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    type: row.type as Organization["type"],
    legalName: String(row.legal_name),
    tradeName: String(row.trade_name),
    cnpj: String(row.cnpj),
    email: String(row.email),
    phone: String(row.phone),
    addressLine: String(row.address_line ?? ""),
    addressNumber: row.address_number ? String(row.address_number) : undefined,
    addressComplement: row.address_complement ? String(row.address_complement) : undefined,
    neighborhood: String(row.neighborhood ?? ""),
    city: String(row.city),
    state: String(row.state),
    postalCode: String(row.postal_code ?? ""),
    responsibleName: String(row.responsible_name),
    responsibleRole: String(row.responsible_role),
    status: row.status as OrganizationStatus,
    verificationStatus: (row.verification_status ??
      "unverified") as Organization["verificationStatus"],
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    createdAt: String(row.created_at),
  };
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("organizations")
      .select(
        "id,type,legal_name,trade_name,cnpj,email,phone,address_line,address_number,address_complement,neighborhood,city,state,postal_code,responsible_name,responsible_role,status,verification_status,rejection_reason,created_at",
      )
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else {
      setOrganizations((data ?? []).map(mapOrganization));
      setError("");
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { organizations, loading, error, refresh };
}

export type OrganizationSettings = {
  tradeName: string;
  email: string;
  phone: string;
  addressLine: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  responsibleName: string;
  responsibleRole: string;
};

export function validateOrganizationSettings(settings: OrganizationSettings) {
  const required = [
    settings.tradeName,
    settings.email,
    settings.phone,
    settings.addressLine,
    settings.neighborhood,
    settings.city,
    settings.state,
    settings.postalCode,
    settings.responsibleName,
    settings.responsibleRole,
  ];
  if (required.some((value) => !value.trim())) return "Preencha todos os campos obrigatórios.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email.trim())) return "Informe um e-mail válido.";
  if (!/^\d{10,11}$/.test(settings.phone.replace(/\D/g, ""))) return "Informe um telefone com DDD.";
  if (!/^\d{8}$/.test(settings.postalCode.replace(/\D/g, "")))
    return "Informe um CEP com 8 números.";
  if (!/^[A-Za-z]{2}$/.test(settings.state.trim())) return "Informe uma UF válida.";
  return "";
}

export async function updateOrganizationSettings(
  organizationId: string,
  settings: OrganizationSettings,
) {
  const validationError = validateOrganizationSettings(settings);
  if (validationError) throw new Error(validationError);
  const { error } = await assertSupabaseConfigured().rpc("update_managed_organization_settings", {
    p_organization_id: organizationId,
    p_trade_name: settings.tradeName,
    p_email: settings.email,
    p_phone: settings.phone,
    p_address_line: settings.addressLine,
    p_address_number: settings.addressNumber,
    p_address_complement: settings.addressComplement,
    p_neighborhood: settings.neighborhood,
    p_city: settings.city,
    p_state: settings.state,
    p_postal_code: settings.postalCode,
    p_responsible_name: settings.responsibleName,
    p_responsible_role: settings.responsibleRole,
  });
  throwSupabaseError(error);
}

export function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calculate = (base: string, weights: number[]) => {
    const total = [...base].reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}
