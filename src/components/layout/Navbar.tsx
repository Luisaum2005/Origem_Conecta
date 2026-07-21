import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { AccessibilityControls } from "@/components/layout/AccessibilityControls";
import { BottomNav } from "@/components/layout/BottomNav";
import { SupportButton } from "@/components/layout/SupportButton";
import { getProfileHome, type ProfileType, useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { Bell, User } from "lucide-react";
import { useState } from "react";

const links = [
  { to: "/portfolio", label: "Portfólio", profiles: ["comprador"] },
  {
    to: "/directory/organizations",
    label: "Cooperativas",
    profiles: ["comprador", "admin"],
  },
  { to: "/orders", label: "Solicitações", profiles: ["comprador"] },
  { to: "/producer/orders", label: "Negociações", profiles: ["produtor"] },
  { to: "/production", label: "Estoque", profiles: ["produtor"] },
  { to: "/demands", label: "Demandas", profiles: ["comprador", "produtor", "admin"] },
  { to: "/chats", label: "Mensagens", profiles: ["comprador", "produtor", "admin"] },
  { to: "/admin", label: "Admin", profiles: ["admin"] },
  { to: "/organizations", label: "Organização", profiles: ["organizacao", "produtor"] },
] as const;
function visible(profiles: readonly ProfileType[], type?: ProfileType) {
  return type ? profiles.includes(type) : false;
}

export function Navbar() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(
    profile?.userId,
  );
  const profilePath =
    profile?.tipo === "comprador"
      ? "/profile/buyer"
      : profile
        ? getProfileHome(profile.tipo)
        : "/login";
  return (
    <>
      <header className="sticky top-0 z-30 h-[64px] border-b border-border bg-white/90 backdrop-blur md:h-[72px]">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-4 xl:gap-8">
            <Logo compactOnMobile />
            <nav className="hidden min-w-0 items-center gap-0.5 md:flex xl:gap-1">
              {links
                .filter((link) => visible(link.profiles, profile?.tipo))
                .filter(
                  (link) =>
                    link.to !== "/organizations" || profile?.roles?.includes("gestor_organizacao"),
                )
                .map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-brand-900 xl:px-3 xl:text-sm"
                    activeProps={{ className: "bg-secondary text-brand-900" }}
                  >
                    {link.label}
                  </Link>
                ))}
            </nav>
          </div>
          <div className="relative flex items-center gap-2">
            <SupportButton compact />
            <AccessibilityControls />
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen(!open)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                aria-label="Notificações"
                aria-expanded={open}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              {open && (
                <div className="fixed inset-x-3 top-[70px] z-50 overflow-hidden rounded-2xl border border-border bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-900">Notificações</p>
                      <p className="text-xs text-muted-foreground">Atualizações da sua conta.</p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        className="text-xs font-semibold text-leaf-700"
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  {loading ? (
                    <p className="px-4 py-5 text-sm text-muted-foreground">Carregando...</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-muted-foreground">
                      Nenhuma notificação ainda.
                    </p>
                  ) : (
                    <ul className="max-h-[min(60vh,420px)] divide-y divide-border overflow-y-auto">
                      {notifications.map((item) => (
                        <li key={item.id} className={item.readAt ? "bg-white" : "bg-leaf-50"}>
                          <a
                            href={item.url}
                            onClick={() => {
                              void markRead(item.id);
                              setOpen(false);
                            }}
                            className="block px-4 py-3 hover:bg-secondary"
                          >
                            <span className="flex items-center gap-2 text-sm font-semibold text-brand-900">
                              {!item.readAt && (
                                <span className="h-2 w-2 rounded-full bg-orange-600" />
                              )}
                              {item.title}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                              {item.body}
                            </span>
                            <time className="mt-1 block text-[10px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString("pt-BR")}
                            </time>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <Link
              to={profilePath}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-secondary px-3 text-sm font-medium text-brand-900"
            >
              <User className="h-4 w-4" />
              <span className="hidden md:inline">{profile?.nome ?? "Entrar"}</span>
            </Link>
            {profile && (
              <button
                type="button"
                onClick={() => signOut()}
                className="hidden h-10 rounded-full px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary md:inline-flex md:items-center"
              >
                Sair
              </button>
            )}
          </div>
        </div>
      </header>
      <BottomNav />
    </>
  );
}
