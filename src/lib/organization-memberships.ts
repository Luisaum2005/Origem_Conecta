import { assertSupabaseConfigured, supabase, throwSupabaseError } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type MembershipStatus = "invited" | "pending" | "active" | "rejected" | "inactive";
export type Membership = {
  id: string;
  organizationId: string;
  organizationName: string;
  producerName: string;
  producerEmail: string;
  propertyName: string;
  status: MembershipStatus;
  memberNumber?: string;
  canSell: boolean;
  createdAt: string;
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
function mapMembership(row: Record<string, unknown>): Membership {
  const organization = one(row.organizations);
  const producer = one(row.producers);
  const profile = one(producer.profiles);
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    organizationName: String(organization.trade_name ?? "Organização"),
    producerName: String(producer.responsavel ?? profile.nome ?? "Produtor"),
    producerEmail: String(profile.email ?? ""),
    propertyName: String(producer.nome_propriedade ?? "Propriedade"),
    status: row.status as MembershipStatus,
    memberNumber: row.member_number ? String(row.member_number) : undefined,
    canSell: Boolean(row.can_sell_through_organization),
    createdAt: String(row.created_at),
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
    let query = supabase
      .from("organization_members")
      .select(
        "id,organization_id,status,member_number,can_sell_through_organization,created_at,organizations(trade_name),producers(nome_propriedade,responsavel,profiles(nome,email))",
      )
      .order("created_at", { ascending: false });
    if (organizationId) query = query.eq("organization_id", organizationId);
    const { data, error: queryError } = await query;
    if (queryError) setError(queryError.message);
    else {
      setMemberships((data ?? []).map((row) => mapMembership(row as Record<string, unknown>)));
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
export const deactivateMembership = (id: string) =>
  rpc("deactivate_organization_membership", { p_membership_id: id });
