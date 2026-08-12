import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/organizations/messages")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationMessages />
    </RequireProfile>
  ),
});

function OrganizationMessages() {
  const { profile } = useAuth();
  const isProducer = profile?.roles?.includes("produtor");
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[900px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Gestão institucional
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Mensagens</h1>
        <div className="mt-8 rounded-2xl border border-border bg-white p-8 text-center shadow-xs">
          <MessageSquare className="mx-auto h-10 w-10 text-leaf-700" />
          <h2 className="mt-4 text-xl font-bold text-brand-900">
            Conversas ficam com o produtor responsável
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Assim o comprador sempre fala com quem conhece o produto e a entrega. A organização
            continua responsável por autorizar quais associados podem usar seus dados comerciais.
          </p>
          {isProducer && (
            <Link
              to="/chats"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white"
            >
              Abrir minhas mensagens como produtor
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
