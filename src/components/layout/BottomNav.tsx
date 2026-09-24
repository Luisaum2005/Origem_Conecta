import { Link, useLocation } from "@tanstack/react-router";
import {
  ClipboardList,
  Handshake,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Package,
  Store,
  Users,
  type LucideIcon,
} from "@/components/mobile/icons";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getUserConversations, subscribeToConversations } from "@/lib/chats";
import { isOrganizationContext } from "@/lib/organization-navigation";

type TabItem = { to: string; label: string; icon: LucideIcon; exact?: boolean; messages?: boolean };

// Tabbar do redesign mobile (Figma "Mobile · todas as telas"): pílula escura, sem rótulos,
// aba ativa em verde-folha e ponto laranja em Mensagens quando há conversa não lida.
const BUYER: TabItem[] = [
  { to: "/portfolio", label: "Portfólio", icon: Store },
  { to: "/orders", label: "Solicitações", icon: ClipboardList },
  { to: "/demands", label: "Demandas", icon: Megaphone },
  { to: "/chats", label: "Mensagens", icon: MessagesSquare, messages: true },
];
const PRODUCER: TabItem[] = [
  { to: "/producer/orders", label: "Negociações", icon: Handshake },
  { to: "/production", label: "Estoque", icon: Package },
  { to: "/demands", label: "Demandas", icon: Megaphone },
  { to: "/chats", label: "Mensagens", icon: MessagesSquare, messages: true },
];
const ORGANIZATION: TabItem[] = [
  { to: "/organizations", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/organizations/members", label: "Associados", icon: Users },
  { to: "/organizations/products", label: "Produtos", icon: Package },
  { to: "/organizations/negotiations", label: "Negociações", icon: Handshake },
  { to: "/organizations/messages", label: "Mensagens", icon: MessagesSquare, messages: true },
];

// Telas com ação fixa no rodapé ou sem navegação no Figma.
const HIDDEN = [
  "/chat",
  "/product",
  "/order",
  "/tracking",
  "/rating",
  "/directory/organizations",
  "/profile/buyer",
];

function useHasUnread(profileId?: string, profileType?: string) {
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    if (!profileId || !profileType || profileType === "organizacao") return;
    let active = true;
    const load = () =>
      getUserConversations(profileId, profileType as never)
        .then((list) => {
          if (active) setUnread(list.some((item) => (item.unreadCount ?? 0) > 0));
        })
        .catch(() => undefined);
    void load();
    const unsubscribe = subscribeToConversations(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [profileId, profileType]);
  return unread;
}

export function BottomNav() {
  const { pathname, search } = useLocation();
  const { profile } = useAuth();
  const hasUnread = useHasUnread(profile?.id, profile?.tipo);
  const organizationContext = isOrganizationContext(
    pathname,
    Boolean(profile?.roles?.includes("gestor_organizacao")),
  );

  const responding = pathname === "/demands" && Boolean((search as { respond?: string }).respond);
  if (!profile || HIDDEN.includes(pathname) || responding) return null;
  const items = organizationContext
    ? ORGANIZATION
    : profile.tipo === "produtor"
      ? PRODUCER
      : profile.tipo === "comprador"
        ? BUYER
        : profile.tipo === "organizacao"
          ? ORGANIZATION
          : null;
  if (!items) return null;

  return (
    <nav className="m-tabbar lg:!hidden" aria-label="Navegação principal">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.to
          : pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={active ? "m-on" : undefined}
          >
            <Icon className="lucide" aria-hidden />
            {item.messages && hasUnread && !active && <span className="m-dot" />}
          </Link>
        );
      })}
    </nav>
  );
}
