import { supabase } from "@/lib/supabase";
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
  city: string;
  state: string;
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
    city: String(row.city),
    state: String(row.state),
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
        "id,type,legal_name,trade_name,cnpj,email,phone,city,state,responsible_name,responsible_role,status,verification_status,rejection_reason,created_at",
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
