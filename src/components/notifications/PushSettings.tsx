import { useAuth } from "@/lib/auth";
import {
  disablePush,
  enablePush,
  getPushState,
  validateVapidPublicKey,
  type PushState,
} from "@/lib/push-notifications";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";

export function PushSettings() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [state, setState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const configurationError = validateVapidPublicKey(
    import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined,
  );
  useEffect(() => {
    if (!profile || !isSupabaseConfigured) return;
    let active = true;
    getPushState(profile.userId)
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch((error) => {
        if (active)
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível verificar as notificações neste dispositivo.",
          );
      });
    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile]);
  const toggle = async () => {
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
  return (
    <section className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-100 text-brand-700">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold text-brand-900">Notificações neste dispositivo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Receba mensagens e atualizações importantes mesmo com o aplicativo fechado. A permissão
            só será solicitada ao ativar.
          </p>
          <button
            type="button"
            onClick={toggle}
            disabled={
              busy ||
              state === "unsupported" ||
              state === "denied" ||
              !isSupabaseConfigured ||
              Boolean(configurationError)
            }
            className="mt-4 h-10 rounded-xl bg-leaf-600 px-4 text-sm font-semibold text-white disabled:bg-gray-300"
          >
            {busy
              ? "Aguarde..."
              : state === "enabled"
                ? "Desativar neste dispositivo"
                : "Ativar notificações"}
          </button>
          {state === "denied" && (
            <p className="mt-2 text-xs text-orange-700">
              As notificações estão bloqueadas. Libere a permissão nas configurações do navegador.
            </p>
          )}
          {state === "unsupported" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Este navegador não oferece suporte a Web Push.
            </p>
          )}
          {configurationError && (
            <p className="mt-2 text-xs text-orange-700" role="alert">
              {configurationError} O servidor também precisa ter as chaves privadas correspondentes.
            </p>
          )}
          {notice && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              {notice}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
