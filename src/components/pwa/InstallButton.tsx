import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton({ variant = "default" }: { variant?: "default" | "compact" }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const installedHandler = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    if (typeof navigator !== "undefined") {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
        // @ts-expect-error iOS Safari
        window.navigator.standalone === true;
      if (standalone) setInstalled(true);
      if (isIOS && !standalone) setIosHint(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (installed) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else if (iosHint) {
      alert(
        'No iPhone: toque no botão "Compartilhar" do Safari e escolha "Adicionar à Tela de Início".',
      );
    } else {
      alert(
        'Abra o menu do navegador e escolha "Instalar aplicativo" ou "Adicionar à tela inicial".',
      );
    }
  };

  if (variant === "compact") {
    return (
      <button
        onClick={onClick}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-medium text-brand-900 hover:border-leaf-500"
      >
        <Smartphone className="h-4 w-4" />
        Instalar app
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-6 text-base font-semibold text-brand-900 hover:border-leaf-500"
    >
      <Download className="h-5 w-5 text-leaf-600" />
      Instalar app
    </button>
  );
}
