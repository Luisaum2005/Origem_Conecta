import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { BottomNav } from "@/components/layout/BottomNav";
import { getProfileHome, type ProfileType, useAuth } from "@/lib/auth";
import { useOrders } from "@/lib/orders";
import { useQuoteRequests } from "@/lib/quote-requests";
import { Bell, ClipboardList, MessageSquareText, PackageCheck, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const links = [
  { to: "/portfolio", label: "Portfólio", profiles: ["comprador"] },
  { to: "/orders", label: "Pedidos", profiles: ["comprador"] },
  { to: "/producer/orders", label: "Pedidos recebidos", profiles: ["produtor"] },
  { to: "/production", label: "Estoque", profiles: ["produtor"] },
  { to: "/quotes", label: "Solicitações", profiles: ["comprador", "produtor", "admin"] },
  { to: "/admin", label: "Admin", profiles: ["admin"] },
] as const;

function visibleForProfile(profiles: readonly ProfileType[], profileType?: ProfileType) {
  return profileType ? profiles.includes(profileType) : false;
}

export function Navbar() {
  const { profile, signOut } = useAuth();
  const { orders } = useOrders();
  const { quotes } = useQuoteRequests();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const readStorageKey = profile?.id ? `origem-conecta-read-notifications-${profile.id}` : "";
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("origem-conecta-read-notifications") || "[]");
    } catch {
      return [];
    }
  });
  const [visibleNotifications, setVisibleNotifications] = useState<NotificationItem[]>([]);
  const profilePath =
    profile?.tipo === "comprador"
      ? "/profile/buyer"
      : profile
        ? getProfileHome(profile.tipo)
        : "/login";
  const visibleLinks = links.filter((link) => visibleForProfile(link.profiles, profile?.tipo));
  const notifications = useMemo(
    () => buildNotifications(profile?.tipo, orders, quotes),
    [orders, profile?.tipo, quotes],
  );

  useEffect(() => {
    if (!readStorageKey || typeof window === "undefined") return;
    try {
      setReadNotificationIds(JSON.parse(window.localStorage.getItem(readStorageKey) || "[]"));
    } catch {
      setReadNotificationIds([]);
    }
    setVisibleNotifications([]);
    setNotificationsOpen(false);
  }, [readStorageKey]);

  const unreadNotifications = notifications.filter(
    (notification) => !readNotificationIds.includes(notification.id),
  );

  const toggleNotifications = () => {
    if (notificationsOpen) {
      setNotificationsOpen(false);
      setVisibleNotifications([]);
      return;
    }

    setVisibleNotifications(unreadNotifications);
    const nextReadIds = Array.from(
      new Set([...readNotificationIds, ...unreadNotifications.map((item) => item.id)]),
    );
    setReadNotificationIds(nextReadIds);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        readStorageKey || "origem-conecta-read-notifications",
        JSON.stringify(nextReadIds),
      );
    }
    setNotificationsOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-[64px] border-b border-border bg-white/90 backdrop-blur md:h-[72px]">
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-6 sm:gap-10">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              {visibleLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-brand-900"
                  activeProps={{ className: "bg-secondary text-brand-900" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="relative flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={toggleNotifications}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                aria-label="Notificacoes"
                aria-expanded={notificationsOpen}
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),360px)] overflow-hidden rounded-2xl border border-border bg-white shadow-lg">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold text-brand-900">Notificacoes</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Alertas gerados pela operação atual.
                    </p>
                  </div>
                  {visibleNotifications.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-muted-foreground">
                      Nenhuma notificacao importante no momento.
                    </div>
                  ) : (
                    <ul className="max-h-[360px] divide-y divide-border overflow-y-auto">
                      {visibleNotifications.map((notification) => {
                        const Icon = notification.icon;
                        return (
                          <li key={notification.id}>
                            <Link
                              to={notification.to}
                              onClick={() => setNotificationsOpen(false)}
                              className="flex gap-3 px-4 py-3 hover:bg-secondary"
                            >
                              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-leaf-100 text-brand-700">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-brand-900">
                                  {notification.title}
                                </span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                  {notification.text}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
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
                className="hidden h-10 rounded-full px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-brand-900 md:inline-flex md:items-center"
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

type NotificationItem = {
  id: string;
  title: string;
  text: string;
  to: "/orders" | "/producer/orders" | "/quotes" | "/admin";
  icon: React.ComponentType<{ className?: string }>;
};

function buildNotifications(
  profileType: ProfileType | undefined,
  orders: ReturnType<typeof useOrders>["orders"],
  quotes: ReturnType<typeof useQuoteRequests>["quotes"],
): NotificationItem[] {
  if (!profileType) return [];

  if (profileType === "comprador") {
    return [
      ...orders
        .filter((order) => order.status !== "Entregue")
        .slice(0, 3)
        .map((order) => ({
          id: `buyer-order-${order.id}`,
          title: `Pedido #${order.id}: ${order.status}`,
          text: `${order.items.length} item${order.items.length > 1 ? "s" : ""} com entrega ${order.deliveryEta}.`,
          to: "/orders" as const,
          icon: PackageCheck,
        })),
      ...quotes
        .filter((quote) => quote.status === "Respondida")
        .slice(0, 2)
        .map((quote) => ({
          id: `buyer-quote-${quote.id}`,
          title: "Solicitação aceita",
          text: `${quote.productName} foi aceito por ${quote.producerName ?? "um produtor"}.`,
          to: "/quotes" as const,
          icon: MessageSquareText,
        })),
    ].slice(0, 5);
  }

  if (profileType === "produtor") {
    return [
      ...orders
        .filter((order) => order.status !== "Entregue")
        .slice(0, 4)
        .map((order) => ({
          id: `producer-order-${order.id}`,
          title: `Pedido recebido #${order.id}`,
          text: `${order.items.length} item${order.items.length > 1 ? "s" : ""} aguardando acompanhamento.`,
          to: "/producer/orders" as const,
          icon: ClipboardList,
        })),
      ...quotes
        .filter((quote) => quote.status === "Aberta")
        .slice(0, 2)
        .map((quote) => ({
          id: `producer-quote-${quote.id}`,
          title: "Nova solicitação aberta",
          text: `${quote.productName}, ${quote.quantity} ${quote.unit}.`,
          to: "/quotes" as const,
          icon: MessageSquareText,
        })),
    ].slice(0, 5);
  }

  return [
    ...orders
      .filter((order) => order.status !== "Entregue")
      .slice(0, 3)
      .map((order) => ({
        id: `admin-order-${order.id}`,
        title: `Pedido em aberto #${order.id}`,
        text: `${order.buyerName} - ${order.status} - R$ ${order.total.toFixed(2)}.`,
        to: "/admin" as const,
        icon: ClipboardList,
      })),
    ...quotes
      .filter((quote) => quote.status === "Aberta" || quote.status === "Respondida")
      .slice(0, 3)
      .map((quote) => ({
        id: `admin-quote-${quote.id}`,
        title: `Solicitação ${quote.status.toLowerCase()}`,
        text: `${quote.productName} para ${quote.buyerName}.`,
        to: "/quotes" as const,
        icon: MessageSquareText,
      })),
  ].slice(0, 6);
}
