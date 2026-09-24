import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { InstallButton } from "@/components/pwa/InstallButton";
import { ArrowRight, Building2, LogIn, Sprout, Store } from "lucide-react";
import { getProfileHome, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const { profile, loading } = useAuth();
  if (loading) return <AuthRestoring />;
  if (profile) return <Navigate to={getProfileHome(profile.tipo, profile.roles)} replace />;

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden text-white sm:mx-auto sm:mt-6 sm:max-w-[1200px] sm:rounded-[28px]">
        <img src="/img/campo.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,61,34,.55),rgba(20,61,34,.25)_40%,rgba(20,61,34,.95))]" />
        <header className="relative flex items-center justify-between px-4 py-5 sm:px-8">
          <span className="rounded-2xl bg-white/95 px-2.5 py-1.5 shadow-sm">
            <Logo />
          </span>
          <Link
            to="/login"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </Link>
        </header>
        <div className="relative px-5 pb-16 pt-24 sm:px-10 sm:pb-20 sm:pt-32">
          <h1 className="text-[30px] font-normal leading-tight tracking-tight text-white sm:text-5xl">
            Da roça
            <span className="block text-[34px] font-semibold sm:text-6xl">para a sua cozinha.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-white/85 sm:text-base">
            Produtores da região vendendo direto para restaurantes, mercados e cozinhas.
          </p>
        </div>
      </section>

      <main className="relative mx-auto -mt-7 max-w-[1200px] rounded-t-[28px] bg-canvas px-5 pb-16 pt-6 sm:mt-8 sm:rounded-none sm:bg-transparent sm:px-8">
        <h2 className="text-lg font-semibold text-brand-900">Como você vai usar?</h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3 sm:gap-4">
          <RoleCard
            to="/signup/buyer"
            icon={<Store className="h-5 w-5" />}
            title="Vou comprar"
            body="Restaurante, mercado, hotel ou cozinha"
          />
          <RoleCard
            to="/signup/producer"
            icon={<Sprout className="h-5 w-5" />}
            title="Vou vender"
            body="Produtor rural, com ou sem cooperativa"
          />
          <RoleCard
            to="/signup/organization"
            icon={<Building2 className="h-5 w-5" />}
            title="Represento um grupo"
            body="Cooperativa ou associação de produtores"
          />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground sm:text-left">
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Entrar
          </Link>
        </p>
        <div className="mx-auto mt-4 max-w-md sm:mx-0">
          <InstallButton />
        </div>
      </main>
    </div>
  );
}

function RoleCard({
  to,
  icon,
  title,
  body,
}: {
  to: "/signup/buyer" | "/signup/producer" | "/signup/organization";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="surface-card group flex items-center gap-3 p-3 transition-transform hover:-translate-y-0.5"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-leaf-100 text-brand-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-brand-900">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function AuthRestoring() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="rounded-2xl border border-border bg-white px-5 py-4 text-sm font-semibold text-brand-900 shadow-xs">
        Restaurando sua sessão...
      </div>
    </div>
  );
}
