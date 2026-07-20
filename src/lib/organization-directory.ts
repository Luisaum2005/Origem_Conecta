import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type PublicOrganization = {
  id: string;
  type: "cooperativa" | "associacao";
  tradeName: string;
  city: string;
  state: string;
  verificationStatus: "unverified" | "verified" | "failed";
  activeMembers: number;
  suppliedProducts: string[];
};

function mapOrganization(row: Record<string, unknown>): PublicOrganization {
  return {
    id: String(row.id),
    type: row.type === "cooperativa" ? "cooperativa" : "associacao",
    tradeName: String(row.trade_name ?? "Organização"),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    verificationStatus:
      row.verification_status === "verified"
        ? "verified"
        : row.verification_status === "failed"
          ? "failed"
          : "unverified",
    activeMembers: Number(row.active_members ?? 0),
    suppliedProducts: Array.isArray(row.supplied_products) ? row.supplied_products.map(String) : [],
  };
}

export function useOrganizationDirectory(query: string) {
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const { data, error: queryError } = await client.rpc("list_public_organizations", {
        p_query: query.trim(),
      });
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setOrganizations([]);
      } else {
        setError("");
        setOrganizations((data ?? []).map((row: Record<string, unknown>) => mapOrganization(row)));
      }
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return { organizations, loading, error };
}
