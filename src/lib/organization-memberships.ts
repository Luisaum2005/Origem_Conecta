import { assertSupabaseConfigured, supabase, throwSupabaseError } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type MembershipStatus = "invited" | "pending" | "active" | "rejected" | "inactive";
export type Membership = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationType?: "cooperativa" | "associacao";
  organizationCity?: string;
  organizationState?: string;
  producerName: string;
  producerEmail: string;
  producerPhone?: string;
  propertyName: string;
  location?: string;
  products: string[];
  status: MembershipStatus;
  memberNumber?: string;
  canSell: boolean;
  commercializationMode: "own" | "organization" | "undecided";
  activeProductsCount: number;
  openNegotiationsCount: number;
  joinedAt?: string;
  createdAt: string;
  updatedAt?: string;
};
export type OrganizationSearchResult = {
  id: string;
  type: "cooperativa" | "associacao";
  tradeName: string;
  legalName: string;
  cnpj: string;
  city: string;
  state: string;
  verificationStatus: "unverified" | "verified" | "failed";
};

function one(value: unknown): Record<string, unknown> {
  return (Array.isArray(value) ? value[0] : (value ?? {})) as Record<string, unknown>;
}
export function mapMembership(row: Record<string, unknown>): Membership {
  const organization = one(row.organizations);
  const producer = one(row.producers);
  const profile = one(producer.profiles);
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name ?? organization.trade_name ?? "Organização"),
    organizationType: (row.organization_type ?? organization.type) as
      | Membership["organizationType"]
      | undefined,
    organizationCity: String(row.organization_city ?? organization.city ?? "") || undefined,
    organizationState: String(row.organization_state ?? organization.state ?? "") || undefined,
    producerName: String(row.producer_name ?? producer.responsavel ?? profile.nome ?? "Produtor"),
    producerEmail: String(row.producer_email ?? profile.email ?? ""),
    producerPhone: String(row.producer_phone ?? profile.telefone ?? "") || undefined,
    propertyName: String(row.property_name ?? producer.nome_propriedade ?? "Propriedade"),
    location: row.producer_location
      ? String(row.producer_location)
      : producer.localizacao
        ? String(producer.localizacao)
        : undefined,
    products: Array.isArray(row.products)
      ? row.products.map(String)
      : Array.isArray(producer.categorias_atendidas)
        ? producer.categorias_atendidas.map(String)
        : [],
    status: row.status as MembershipStatus,
    memberNumber: row.member_number ? String(row.member_number) : undefined,
    canSell: Boolean(row.can_sell ?? row.can_sell_through_organization),
    commercializationMode: (row.commercialization_mode ??
      producer.commercialization_mode ??
      "undecided") as Membership["commercializationMode"],
    activeProductsCount: Number(row.active_products_count ?? 0),
    openNegotiationsCount: Number(row.open_negotiations_count ?? 0),
    joinedAt: row.joined_at ? String(row.joined_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function useMemberships(organizationId?: string) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = organizationId
      ? await supabase.rpc("list_managed_organization_members", {
          p_organization_id: organizationId,
        })
      : await supabase.rpc("list_my_producer_memberships");
    const { data, error: queryError } = result;
    if (queryError) setError(queryError.message);
    else {
      setMemberships((data ?? []).map((row: Record<string, unknown>) => mapMembership(row)));
      setError("");
    }
    setLoading(false);
  }, [organizationId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { memberships, loading, error, refresh };
}
export async function searchOrganizations(query = ""): Promise<OrganizationSearchResult[]> {
  const { data, error } = await assertSupabaseConfigured().rpc("search_active_organizations", {
    p_query: query,
  });
  throwSupabaseError(error);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    type: row.type as OrganizationSearchResult["type"],
    tradeName: String(row.trade_name),
    legalName: String(row.legal_name),
    cnpj: String(row.cnpj),
    city: String(row.city),
    state: String(row.state),
    verificationStatus: row.verification_status as OrganizationSearchResult["verificationStatus"],
  }));
}
async function rpc(name: string, params: Record<string, unknown>) {
  const { error } = await assertSupabaseConfigured().rpc(name, params);
  throwSupabaseError(error);
}
export const requestMembership = (organizationId: string) =>
  rpc("request_organization_membership", { p_organization_id: organizationId });
export const inviteProducer = (organizationId: string, email: string) =>
  rpc("invite_producer_to_organization", { p_organization_id: organizationId, p_email: email });
export const reviewMembership = (id: string, accept: boolean, memberNumber?: string) =>
  rpc("review_membership_request", {
    p_membership_id: id,
    p_accept: accept,
    p_member_number: memberNumber || null,
  });
export const respondInvite = (id: string, accept: boolean) =>
  rpc("respond_membership_invite", { p_membership_id: id, p_accept: accept });
export const setCommercialPermission = (id: string, allowed: boolean) =>
  rpc("set_member_commercial_permission", { p_membership_id: id, p_allowed: allowed });
export const updateMemberNumber = (id: string, memberNumber: string) =>
  rpc("update_organization_member_number", {
    p_membership_id: id,
    p_member_number: memberNumber,
  });
export const deactivateMembership = (id: string) =>
  rpc("deactivate_organization_membership", { p_membership_id: id });
export const cancelInvitation = (id: string) =>
  rpc("cancel_organization_invitation", { p_membership_id: id });
