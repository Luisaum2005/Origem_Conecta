import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { AccessibilityControls } from "@/components/layout/AccessibilityControls";
import { BottomNav } from "@/components/layout/BottomNav";
import { SupportButton } from "@/components/layout/SupportButton";
import { getProfileHome, type ProfileType, useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { Bell, Building2, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const [accountOpen, setAccountOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead } =
    useNotifications(profile?.userId);
  const profilePath =
    profile?.tipo === "comprador"
      ? "/profile/buyer"
      : profile
        ? getProfileHome(profile.tipo)
        : "/login";
  useEffect(() => {
    if (!open) return;
    const panel = notificationPanelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>("button, a[href]");
    firstFocusable?.focus();
    const close = () => {
      setOpen(false);
      notificationButtonRef.current?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel?.contains(target) && !notificationButtonRef.current?.contains(target)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);
  useEffect(() => {
    if (!accountOpen) return;
    const menu = accountMenuRef.current;
    menu?.querySelector<HTMLElement>("a[href], button")?.focus();
    const close = (restoreFocus = true) => {
      setAccountOpen(false);
      if (restoreFocus) requestAnimationFrame(() => accountButtonRef.current?.focus());
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu?.contains(target) && !accountButtonRef.current?.contains(target)) close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [accountOpen]);
  return (
    <>
      <header className="sticky top-0 z-30 h-[64px] border-b border-border bg-white/90 backdrop-blur md:h-[72px]">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-4 xl:gap-8">
            <Logo compactOnMobile />
            <nav className="hidden min-w-0 items-center gap-0.5 lg:flex xl:gap-1">
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
          <div className="relative flex shrink-0 items-center gap-1 sm:gap-2">
            <SupportButton compact />
            <AccessibilityControls />
            <div className="relative">
              <button
                ref={notificationButtonRef}
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
                <div
                  ref={notificationPanelRef}
                  role="dialog"
                  aria-modal="false"
                  aria-label="Notificações"
                  className="fixed inset-x-3 top-[70px] z-50 overflow-hidden rounded-2xl border border-border bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]"
                >
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
                  ) : error ? (
                    <div className="px-4 py-5 text-sm text-red-700" role="alert">
                      <p>{error}</p>
                      <button
                        type="button"
                        onClick={() => void refresh()}
                        className="mt-3 font-semibold underline"
                      >
                        Tentar novamente
                      </button>
                    </div>
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
            <div className="relative lg:hidden">
              <button
                ref={accountButtonRef}
                type="button"
                onClick={() => setAccountOpen((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-brand-900"
                aria-label="Abrir opções da conta"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                aria-controls="account-menu"
              >
                <User className="h-5 w-5" />
              </button>
              {accountOpen && (
                <div
                  ref={accountMenuRef}
                  id="account-menu"
                  role="menu"
                  aria-label="Opções da conta"
                  className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-border bg-white p-2 shadow-lg"
                >
                  <p className="truncate px-3 py-2 text-sm font-semibold text-brand-900">
                    {profile?.nome ?? "Minha conta"}
                  </p>
                  <Link
                    role="menuitem"
                    to={profilePath}
                    onClick={() => setAccountOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-brand-900 hover:bg-secondary"
                  >
                    <User className="h-5 w-5" /> Meu perfil
                  </Link>
                  {profile?.tipo === "comprador" && (
                    <Link
                      role="menuitem"
                      to="/directory/organizations"
                      onClick={() => setAccountOpen(false)}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-brand-900 hover:bg-secondary"
                    >
                      <Building2 className="h-5 w-5" /> Cooperativas e associações
                    </Link>
                  )}
                  {profile && (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => void signOut()}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <LogOut className="h-5 w-5" /> Sair da conta
                    </button>
                  )}
                </div>
              )}
            </div>
            <Link
              to={profilePath}
              className="hidden h-10 items-center gap-2 rounded-full bg-secondary px-3 text-sm font-medium text-brand-900 lg:inline-flex"
            >
              <User className="h-4 w-4" />
              <span>{profile?.nome ?? "Entrar"}</span>
            </Link>
            {profile && (
              <button
                type="button"
                onClick={() => signOut()}
                className="hidden h-10 rounded-full px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary lg:inline-flex lg:items-center"
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
