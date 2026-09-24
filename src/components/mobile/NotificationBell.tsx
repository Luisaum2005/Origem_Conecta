import { Bell } from "@/components/mobile/icons";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";

/** Sino redondo do redesign (branco ou "glass" sobre foto) com contador e painel. */
export function NotificationBell({ glass = false }: { glass?: boolean }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead } =
    useNotifications(profile?.userId);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`m-round${glass ? " m-glass" : ""}`}
        aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : "Notificações"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="lucide" aria-hidden />
        {unreadCount > 0 && (
          <span className="m-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>
      {open && (
        <div ref={panelRef} role="dialog" aria-label="Notificações" className="m-notif">
          <div className="m-notif-hd">
            <b>Notificações</b>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {loading ? (
            <p className="m-notif-empty">Carregando...</p>
          ) : error ? (
            <p className="m-notif-empty" role="alert">
              {error}{" "}
              <button type="button" onClick={() => void refresh()}>
                Tentar novamente
              </button>
            </p>
          ) : notifications.length === 0 ? (
            <p className="m-notif-empty">Nenhuma notificação ainda.</p>
          ) : (
            <ul>
              {notifications.map((item) => (
                <li key={item.id} className={item.readAt ? undefined : "m-unread"}>
                  <a
                    href={item.url}
                    onClick={() => {
                      void markRead(item.id);
                      setOpen(false);
                    }}
                  >
                    <b>{item.title}</b>
                    <span>{item.body}</span>
                    <time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
