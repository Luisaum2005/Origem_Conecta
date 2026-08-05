import { useAuth } from "@/lib/auth";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  completePushOnboarding,
  disablePush,
  enablePush,
  getNotificationPreferences,
  getPushState,
  saveNotificationPreferences,
  validateVapidPublicKey,
  type NotificationPreferences,
  type PushState,
} from "@/lib/push-notifications";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";

const preferenceOptions: Array<{
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}> = [
  {
    key: "messages",
    label: "Mensagens",
    description: "Novas mensagens recebidas nas suas conversas.",
  },
  {
    key: "orders",
    label: "Negociações e pedidos",
    description: "Novas negociações e mudanças na situação dos pedidos.",
  },
  {
    key: "demands",
    label: "Demandas",
    description: "Novas demandas compatíveis, respostas e atualizações.",
  },
  {
    key: "ratings",
    label: "Avaliações",
    description: "Avisos sobre avaliações recebidas.",
  },
  {
    key: "systemNotifications",
    label: "Estoque e avisos importantes",
    description: "Estoque mínimo e comunicados importantes da plataforma.",
  },
];

export function PushSettings() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [state, setState] = useState<PushState>("default");
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingPreference, setSavingPreference] = useState<keyof NotificationPreferences | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const configurationError = validateVapidPublicKey(
    import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined,
  );

  useEffect(() => {
    if (!profile || !isSupabaseConfigured) return;
    let active = true;
    Promise.all([getPushState(profile.userId), getNotificationPreferences(profile.userId)])
      .then(([nextState, nextPreferences]) => {
        if (!active) return;
        setState(nextState);
        setPreferences(nextPreferences);
      })
      .catch((error) => {
        if (active) {
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as configurações de notificações.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingPreferences(false);
      });
    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile]);

  const toggleDevice = async () => {
    if (!profile || !isSupabaseConfigured) return;
    setBusy(true);
    setNotice("");
    try {
      if (state === "enabled") {
        await disablePush();
        setState("disabled");
        setNotice("Notificações desativadas neste dispositivo.");
      } else {
        setState(await enablePush(profile.userId));
        completePushOnboarding(profile.userId);
        setNotice("Notificações ativadas neste dispositivo.");
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível alterar as notificações.",
      );
      setState(await getPushState(profile.userId));
    } finally {
      setBusy(false);
    }
  };

  const togglePreference = async (key: keyof NotificationPreferences) => {
    if (!profile || !isSupabaseConfigured || savingPreference) return;
    const previous = preferences;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSavingPreference(key);
    setNotice("");
    try {
      await saveNotificationPreferences(profile.userId, next);
      setNotice("Preferências salvas.");
    } catch (error) {
      setPreferences(previous);
      setNotice(
        error instanceof Error ? error.message : "Não foi possível salvar suas preferências.",
      );
    } finally {
      setSavingPreference(null);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-100 text-brand-700">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-brand-900">Notificações neste dispositivo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Receba avisos mesmo com o aplicativo fechado. A permissão só será solicitada quando você
            tocar em ativar.
          </p>
          <button
            type="button"
            onClick={() => void toggleDevice()}
            disabled={
              busy ||
              state === "unsupported" ||
              state === "denied" ||
              !isSupabaseConfigured ||
              Boolean(configurationError)
            }
            className="mt-4 min-h-11 rounded-xl bg-leaf-600 px-4 text-sm font-semibold text-white hover:bg-leaf-700 disabled:bg-gray-300"
          >
            {busy
              ? "Aguarde..."
              : state === "enabled"
                ? "Desativar neste dispositivo"
                : "Ativar notificações"}
          </button>
          {state === "enabled" && (
            <p className="mt-2 text-sm font-medium text-green-700">Ativadas neste dispositivo.</p>
          )}
          {state === "denied" && (
            <p className="mt-2 text-sm text-orange-700">
              Estão bloqueadas. Libere a permissão nas configurações do navegador.
            </p>
          )}
          {state === "unsupported" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Este navegador não oferece suporte a Web Push.
            </p>
          )}
          {configurationError && (
            <p className="mt-2 text-sm text-orange-700" role="alert">
              {configurationError} O servidor também precisa ter as chaves privadas correspondentes.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="font-semibold text-brand-900">Quais avisos você quer receber?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Essas escolhas valem para as notificações push. Os avisos continuam disponíveis no sino do
          aplicativo.
        </p>
        {loadingPreferences ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando preferências...</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {preferenceOptions.map((option) => (
              <li key={option.key} className="flex min-h-[68px] items-center gap-4 px-4 py-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-4">
                  <span>
                    <span className="block text-sm font-semibold text-brand-900">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences[option.key]}
                    disabled={!isSupabaseConfigured || Boolean(savingPreference)}
                    onChange={() => void togglePreference(option.key)}
                    className="h-6 w-6 shrink-0 accent-[var(--color-brand-900)]"
                    aria-label={`Receber ${option.label.toLowerCase()}`}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
        {notice && (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
