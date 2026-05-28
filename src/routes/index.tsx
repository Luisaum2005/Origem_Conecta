import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { ArrowRight, Sprout, Store, Truck, ShieldCheck } from "lucide-react";
import { InstallButton } from "@/components/pwa/InstallButton";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-5 sm:px-8 sm:py-6">
        <Logo />
        <Link
          to="/login"
          className="text-sm font-medium text-brand-900 hover:underline underline-offset-4"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 sm:px-8 sm:pt-12 sm:pb-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
          <section>
            <span className="inline-flex items-center gap-2 rounded-full bg-leaf-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-leaf-600" />
              Plataforma B2B agrícola
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-brand-900 sm:text-5xl md:text-6xl">
              Abastecimento{" "}
              <span className="relative inline-block">
                inteligente
                <span className="absolute inset-x-0 -bottom-1 h-3 -z-0 bg-orange-100" />
              </span>
              <br />
              <span className="text-brand-700">entre produção local e demanda real.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
              Portfólio curado semanalmente, distribuição automática entre produtores próximos e
              rastreamento simplificado da entrega — com previsibilidade do pedido à cozinha.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row">
              <Link
                to="/signup/buyer"
                className="group inline-flex h-[52px] items-center justify-between gap-4 rounded-xl bg-brand-900 pl-6 pr-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-brand-800 hover:shadow-md"
              >
                <span className="inline-flex items-center gap-3">
                  <Store className="h-5 w-5" />
                  Sou comprador
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link
                to="/signup/producer"
                className="group inline-flex h-[52px] items-center justify-between gap-4 rounded-xl border border-border bg-white pl-6 pr-3 text-base font-semibold text-brand-900 shadow-xs transition-all hover:border-leaf-500 hover:shadow-sm"
              >
                <span className="inline-flex items-center gap-3">
                  <Sprout className="h-5 w-5 text-leaf-600" />
                  Sou produtor
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>

            <div className="mt-6 max-w-md">
              <InstallButton />
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6 sm:mt-12 sm:gap-6 sm:pt-8">
              {[
                ["+320", "produtores ativos"],
                ["98%", "entregas no prazo"],
                ["3x/sem", "ciclos de entrega"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xl font-bold text-brand-900 sm:text-2xl">{k}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="relative">
            <div className="absolute inset-0 -z-10 rounded-[24px] bg-surface-brand-soft sm:rounded-[32px]" />
            <div className="grid gap-3 p-4 sm:gap-4 sm:p-8">
              <FeatureCard
                icon={<Store className="h-5 w-5" />}
                title="Portfólio semanal"
                body="Catálogo curado e atualizado a cada ciclo, com origem e produtor visíveis."
                tone="brand"
              />
              <FeatureCard
                icon={<Truck className="h-5 w-5" />}
                title="Distribuição inteligente"
                body="Seu pedido é alocado automaticamente entre produtores próximos."
                tone="leaf"
              />
              <FeatureCard
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Rastreabilidade"
                body="Acompanhe faturamento, envio e entrega em uma única linha do tempo."
                tone="orange"
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "brand" | "leaf" | "orange";
}) {
  const toneMap = {
    brand: "bg-brand-900 text-white",
    leaf: "bg-leaf-600 text-white",
    orange: "bg-orange-600 text-white",
  };
  return (
    <div className="group flex items-start gap-4 rounded-2xl border border-border bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md">
      <span
        className={`grid h-11 w-11 place-items-center rounded-xl transition-transform group-hover:scale-105 ${toneMap[tone]}`}
      >
        {icon}
      </span>
      <div>
        <h3 className="text-base font-semibold text-brand-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
