import { Link, useLocation } from "@tanstack/react-router";
import { getProfileHome, type ProfileType, useAuth } from "@/lib/auth";
import {
  isNavigationItemActive,
  isOrganizationContext,
  organizationNavigation,
  producerAreaNavigationItem,
} from "@/lib/organization-navigation";
import {
  Building2,
  ClipboardList,
  Megaphone,
  Package,
  Store,
  Truck,
  User,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const items = [
  { to: "/portfolio", label: "Portfólio", icon: Store, profiles: ["comprador"] },
  { to: "/orders", label: "Solicitações", icon: Truck, profiles: ["comprador"] },
  { to: "/producer/orders", label: "Negociações", icon: ClipboardList, profiles: ["produtor"] },
  { to: "/production", label: "Estoque", icon: Package, profiles: ["produtor"] },
  {
    to: "/demands",
    label: "Demandas",
    icon: Megaphone,
    profiles: ["comprador", "produtor", "admin"],
  },
  {
    to: "/chats",
    label: "Mensagens",
    icon: MessageSquare,
    profiles: ["comprador", "produtor", "admin"],
  },
  { to: "/admin", label: "Admin", icon: ClipboardList, profiles: ["admin"] },
] as const;

function visibleForProfile(profiles: readonly ProfileType[], profileType?: ProfileType) {
  return profileType ? profiles.includes(profileType) : false;
}

export function BottomNav() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const institutionalContext = isOrganizationContext(
    pathname,
    Boolean(profile?.roles?.includes("gestor_organizacao")),
  );
  const profilePath =
    profile?.tipo === "comprador"
      ? "/profile/buyer"
      : profile?.tipo === "organizacao"
        ? "/profile/organization"
        : profile
          ? getProfileHome(profile.tipo)
          : "/login";
  const candidateItems = institutionalContext
    ? [
        ...organizationNavigation,
        ...(profile?.roles?.includes("produtor") ? [producerAreaNavigationItem] : []),
      ]
    : profile
      ? [
          ...items.filter((item) => visibleForProfile(item.profiles, profile.tipo)),
          ...(profile.roles?.includes("gestor_organizacao")
            ? [{ to: "/organizations" as const, label: "Organização", icon: Building2 }]
            : []),
          { to: profilePath, label: "Perfil", icon: User },
        ]
      : [{ to: "/login", label: "Entrar", icon: User }];
  const visibleItems = candidateItems.filter(
    (item, index, all) => all.findIndex((candidate) => candidate.to === item.to) === index,
  );
  const hasOverflow = visibleItems.length > 5;
  const primaryItems = hasOverflow ? visibleItems.slice(0, 4) : visibleItems;
  const overflowItems = hasOverflow ? visibleItems.slice(4) : [];
  const isItemActive = (item: { to: string; exact?: boolean }) =>
    isNavigationItemActive(pathname, item.to, item.exact);
  const overflowActive = overflowItems.some(isItemActive);

  useEffect(() => {
    if (!moreOpen) return;
    moreMenuRef.current?.querySelector<HTMLElement>("a[href]")?.focus();

    const close = (restoreFocus = true) => {
      setMoreOpen(false);
      if (restoreFocus) moreButtonRef.current?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!moreMenuRef.current?.contains(target) && !moreButtonRef.current?.contains(target)) {
        close(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [moreOpen]);

  // Conversa e página de produto usam o rodapé para a ação principal.
  if (pathname === "/chat" || pathname === "/product") return null;

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 px-4 lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      aria-label="Navegação principal"
    >
      <ul className="pointer-events-auto mx-auto flex h-16 max-w-[360px] items-stretch justify-around gap-1 rounded-full p-1.5 [background:var(--gradient-brand)] [box-shadow:var(--shadow-float)]">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item);
          return (
            <li key={item.to} className="min-w-0 flex-1">
              <Link
                to={item.to}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                className="relative flex h-full min-w-0 items-center justify-center rounded-full transition-all active:scale-95"
              >
                <span
                  className={`flex h-full w-full items-center justify-center rounded-full transition-all ${
                    isActive ? "cta-leaf" : ""
                  }`}
                >
                  <Icon
                    className={`h-[22px] w-[22px] transition-colors ${
                      isActive ? "text-brand-900" : "text-white/70"
                    }`}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                </span>
                <span className="sr-only">{item.label}</span>
              </Link>
            </li>
          );
        })}
        {hasOverflow && (
          <li className="relative min-w-0 flex-1">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen((current) => !current)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-controls="bottom-nav-more-menu"
              className="relative flex h-full w-full min-w-0 items-center justify-center rounded-full transition-all active:scale-95"
            >
              <span
                className={`flex h-full w-full items-center justify-center rounded-full transition-all ${
                  overflowActive || moreOpen ? "cta-leaf" : ""
                }`}
              >
                <MoreHorizontal
                  className={`h-[22px] w-[22px] ${
                    overflowActive || moreOpen ? "text-brand-900" : "text-white/70"
                  }`}
                />
              </span>
              <span className="sr-only">Mais</span>
            </button>
            {moreOpen && (
              <div
                ref={moreMenuRef}
                id="bottom-nav-more-menu"
                role="menu"
                aria-label="Mais opções de navegação"
                className="absolute bottom-[76px] right-0 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-lg"
              >
                {overflowItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isItemActive(item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setMoreOpen(false)}
                      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
                        isActive
                          ? "bg-leaf-100 text-brand-900"
                          : "text-brand-900 hover:bg-secondary"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </li>
        )}
      </ul>
    </nav>
  );
}
