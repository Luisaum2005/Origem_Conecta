import { supabase } from "@/lib/supabase";
import { useMemberships, type Membership } from "@/lib/organization-memberships";
import {
  listManagedOrganizationProducts,
  type OrganizationProduct,
} from "@/lib/organization-products";
import { useCallback, useEffect, useMemo, useState } from "react";

export type OrganizationDashboardMetrics = {
  activeMembers: number;
  pendingRequests: number;
  invitedMembers: number;
  authorizedMembers: number;
  activeProducts: number;
  pausedProducts: number;
};

export function calculateMembershipMetrics(
  memberships: Membership[],
): Omit<OrganizationDashboardMetrics, "activeProducts" | "pausedProducts"> {
  return memberships.reduce(
    (metrics, membership) => {
      if (membership.status === "active") {
        metrics.activeMembers += 1;
        if (membership.canSell) metrics.authorizedMembers += 1;
      } else if (membership.status === "pending") {
        metrics.pendingRequests += 1;
      } else if (membership.status === "invited") {
        metrics.invitedMembers += 1;
      }
      return metrics;
    },
    { activeMembers: 0, pendingRequests: 0, invitedMembers: 0, authorizedMembers: 0 },
  );
}

export function useOrganizationDashboard(organizationIds: string[]) {
  const { memberships, loading: membershipsLoading, error: membershipsError } = useMemberships();
  const [inventory, setInventory] = useState<Array<{ ativo: boolean }>>([]);
  const [inventoryLoading, setInventoryLoading] = useState(Boolean(supabase));
  const [inventoryError, setInventoryError] = useState("");
  const organizationKey = organizationIds.join(",");

  const loadInventory = useCallback(async () => {
    if (!supabase || organizationIds.length === 0) {
      setInventory([]);
      setInventoryLoading(false);
      return;
    }
    setInventoryLoading(true);
    try {
      const products = await listManagedOrganizationProducts();
      setInventory(
        products
          .filter((product: OrganizationProduct) =>
            organizationIds.includes(product.organizationId),
          )
          .map((product: OrganizationProduct) => ({ ativo: product.active })),
      );
      setInventoryError("");
    } catch (error) {
      setInventoryError(
        error instanceof Error ? error.message : "Nao foi possivel carregar os produtos.",
      );
    }
    setInventoryLoading(false);
  }, [organizationKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const organizationMemberships = useMemo(
    () => memberships.filter((membership) => organizationIds.includes(membership.organizationId)),
    [memberships, organizationKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const membershipMetrics = useMemo(
    () => calculateMembershipMetrics(organizationMemberships),
    [organizationMemberships],
  );
  const metrics: OrganizationDashboardMetrics = {
    ...membershipMetrics,
    activeProducts: inventory.filter((item) => item.ativo).length,
    pausedProducts: inventory.filter((item) => !item.ativo).length,
  };

  return {
    metrics,
    pendingMemberships: organizationMemberships.filter((item) => item.status === "pending"),
    loading: membershipsLoading || inventoryLoading,
    error: membershipsError || inventoryError,
  };
}
