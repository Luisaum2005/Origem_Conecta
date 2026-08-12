import { Building2, ClipboardList, MessageSquare, Package, User, Users } from "lucide-react";

export const organizationNavigation = [
  { to: "/organizations" as const, label: "Painel", icon: Building2, exact: true },
  { to: "/organizations/members" as const, label: "Associados", icon: Users, exact: false },
  { to: "/organizations/products" as const, label: "Produtos", icon: Package, exact: false },
  {
    to: "/organizations/negotiations" as const,
    label: "Negociações",
    icon: ClipboardList,
    exact: false,
  },
  {
    to: "/organizations/messages" as const,
    label: "Mensagens",
    icon: MessageSquare,
    exact: false,
  },
  { to: "/profile/organization" as const, label: "Perfil", icon: User, exact: false },
] as const;

export function isOrganizationContext(pathname: string, canManageOrganization: boolean) {
  return (
    canManageOrganization &&
    (pathname === "/organizations" ||
      pathname.startsWith("/organizations/") ||
      pathname === "/profile/organization")
  );
}

export function isNavigationItemActive(pathname: string, to: string, exact = false) {
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}
