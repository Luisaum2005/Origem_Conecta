import { Link, useLocation } from "@tanstack/react-router";
import { getProfileHome, type ProfileType, useAuth } from "@/lib/auth";
import { ClipboardList, Megaphone, Package, Store, Truck, User } from "lucide-react";

const items = [
  { to: "/portfolio", label: "Portfólio", icon: Store, profiles: ["comprador"] },
  { to: "/orders", label: "Pedidos", icon: Truck, profiles: ["comprador"] },
  { to: "/producer/orders", label: "Pedidos", icon: ClipboardList, profiles: ["produtor"] },
  { to: "/production", label: "Estoque", icon: Package, profiles: ["produtor"] },
  {
    to: "/demands",
    label: "Demandas",
    icon: Megaphone,
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
  const profilePath =
    profile?.tipo === "comprador"
      ? "/profile/buyer"
      : profile
        ? getProfileHome(profile.tipo)
        : "/login";
  const visibleItems = profile
    ? [
        ...items.filter((item) => visibleForProfile(item.profiles, profile.tipo)),
        { to: profilePath, label: "Perfil", icon: User },
      ]
    : [{ to: "/login", label: "Entrar", icon: User }];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex h-[68px] max-w-md items-stretch justify-around px-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.to.split("/").slice(0, 2).join("/"));
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className="relative flex h-full min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl transition-all active:scale-95"
              >
                <span
                  className={`flex h-9 w-12 items-center justify-center rounded-full transition-all ${
                    isActive ? "bg-leaf-100" : ""
                  }`}
                >
                  <Icon
                    className={`h-[22px] w-[22px] transition-colors ${
                      isActive ? "text-brand-900" : "text-muted-foreground"
                    }`}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                </span>
                <span
                  className={`text-[11px] leading-none transition-colors ${
                    isActive ? "font-semibold text-brand-900" : "font-medium text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
