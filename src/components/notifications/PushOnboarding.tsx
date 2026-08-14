import { getProfileHome, useAuth } from "@/lib/auth";
import { useLocation } from "@tanstack/react-router";
import {
  completePushOnboarding,
  enablePush,
  getPushState,
  PUSH_ONBOARDING_COMPLETED_EVENT,
  validateVapidPublicKey,
  type PushState,
} from "@/lib/push-notifications";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { reportAppError } from "@/lib/error-monitor";

const PUSH_UNAVAILABLE_MESSAGE =
  "As notificações estão temporariamente indisponíveis. Você poderá ativá-las depois em seu perfil.";

export function PushOnboarding() {
  const { profile, isSupabaseConfigured } = useAuth();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [visible, setVisible] = useState(false);
  const [pushState, setPushState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configurationError = validateVapidPublicKey(
    import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined,
  );

  useEffect(() => {
    if (configurationError) {
      reportAppError(new Error(configurationError), {
        source: "push-onboarding",
        kind: "configuration",
      });
    }
  }, [configurationError]);

  useEffect(() => {
    if (!profile || !isSupabaseConfigured) {
      setVisible(false);
      return;
    }
    let active = true;
    getPushState(profile.userId)
      .then((state) => {
        if (!active) return;
        setPushState(state);
        if (state === "enabled") {
          completePushOnboarding(profile.userId);
          setVisible(false);
        } else {
          setVisible(true);
        }
      })
      .catch(() => {
        if (active) setVisible(true);
      });
    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile]);

  useEffect(() => {
    if (!profile) return;
    const hideAfterActivation = (event: Event) => {
      if ((event as CustomEvent<string>).detail === profile.userId) setVisible(false);
    };
    window.addEventListener(PUSH_ONBOARDING_COMPLETED_EVENT, hideAfterActivation);
    return () => window.removeEventListener(PUSH_ONBOARDING_COMPLETED_EVENT, hideAfterActivation);
  }, [profile]);

  const isHomeScreen = profile ? pathname === getProfileHome(profile.tipo, profile.roles) : false;

  if (!visible || !profile || !isHomeScreen) return null;

  const activate = async () => {
    setBusy(true);
    setError("");
    try {
      await enablePush(profile.userId);
      completePushOnboarding(profile.userId);
      setVisible(false);
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "Não foi possível ativar as notificações.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="border-b border-leaf-200 bg-leaf-50" aria-labelledby="push-onboarding-title">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-8">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-leaf-700 sm:grid">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="push-onboarding-title" className="font-semibold text-brand-900">
            Ative as notificações para não perder atualizações
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ative as notificações para acompanhar mensagens, negociações e alertas de estoque mesmo
            quando o aplicativo estiver fechado.
          </p>
          {(error || configurationError) && (
            <p className="mt-2 text-sm font-medium text-red-700" role="alert">
              {configurationError ? PUSH_UNAVAILABLE_MESSAGE : error}
            </p>
          )}
          {pushState === "denied" && !error && (
            <p className="mt-2 text-sm font-medium text-orange-700" role="alert">
              As notificações estão bloqueadas. Libere a permissão nas configurações do navegador.
            </p>
          )}
          {pushState === "unsupported" && !error && (
            <p className="mt-2 text-sm text-muted-foreground">
              Este navegador não oferece suporte a notificações push.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => void activate()}
            disabled={
              busy ||
              pushState === "denied" ||
              pushState === "unsupported" ||
              Boolean(configurationError)
            }
            className="min-h-11 rounded-xl bg-leaf-600 px-4 text-sm font-semibold text-white hover:bg-leaf-700 disabled:bg-gray-300"
          >
            {busy ? "Ativando..." : "Ativar notificações"}
          </button>
        </div>
      </div>
    </aside>
  );
}
