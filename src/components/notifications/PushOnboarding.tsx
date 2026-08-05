import { useAuth } from "@/lib/auth";
import {
  completePushOnboarding,
  enablePush,
  getPushState,
  hasPendingPushOnboarding,
  PUSH_ONBOARDING_COMPLETED_EVENT,
  validateVapidPublicKey,
} from "@/lib/push-notifications";
import { BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "origem-conecta-push-onboarding-dismissed";

export function PushOnboarding() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configurationError = validateVapidPublicKey(
    import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined,
  );

  useEffect(() => {
    if (!profile || !isSupabaseConfigured || !hasPendingPushOnboarding(profile.userId)) {
      setVisible(false);
      return;
    }
    if (window.sessionStorage.getItem(`${DISMISSED_KEY}:${profile.userId}`) === "true") return;
    let active = true;
    getPushState(profile.userId)
      .then((state) => {
        if (!active) return;
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

  if (!visible || !profile) return null;

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

  const dismiss = () => {
    window.sessionStorage.setItem(`${DISMISSED_KEY}:${profile.userId}`, "true");
    setVisible(false);
  };

  return (
    <aside className="border-b border-leaf-200 bg-leaf-50" aria-labelledby="push-onboarding-title">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-8">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-leaf-700 sm:grid">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="push-onboarding-title" className="font-semibold text-brand-900">
            Quer receber avisos importantes?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ative as notificações para acompanhar mensagens, negociações e alertas de estoque mesmo
            quando o aplicativo estiver fechado.
          </p>
          {(error || configurationError) && (
            <p className="mt-2 text-sm font-medium text-red-700" role="alert">
              {error || configurationError}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void activate()}
            disabled={busy || Boolean(configurationError)}
            className="min-h-11 rounded-xl bg-leaf-600 px-4 text-sm font-semibold text-white hover:bg-leaf-700 disabled:bg-gray-300"
          >
            {busy ? "Ativando..." : "Ativar notificações"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-white"
            aria-label="Lembrar de ativar notificações depois"
          >
            <X className="h-4 w-4" /> Agora não
          </button>
        </div>
      </div>
    </aside>
  );
}
