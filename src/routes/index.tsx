import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { ChefHat, Sprout, Users } from "@/components/mobile/icons";
import { useState } from "react";
import logoImg from "@/assets/logo.png";
import { getProfileHome, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Splash,
});

const ROLES = [
  {
    to: "/signup/buyer",
    icon: ChefHat,
    title: "Vou comprar",
    body: "Restaurante, mercado, hotel ou cozinha",
  },
  {
    to: "/signup/producer",
    icon: Sprout,
    title: "Vou vender",
    body: "Produtor rural, com ou sem cooperativa",
  },
  {
    to: "/signup/organization",
    icon: Users,
    title: "Represento um grupo",
    body: "Cooperativa ou associação de produtores",
  },
] as const;

function Splash() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<(typeof ROLES)[number]["to"]>("/signup/buyer");
  if (loading) return <AuthRestoring />;
  if (profile) return <Navigate to={getProfileHome(profile.tipo, profile.roles)} replace />;

  return (
    <div className="m-screen m-s-a1-boas-vindas">
      <div className="m-hero">
        <img src="/img/campo.jpg" alt="" />
        <div className="m-veil" />
        <div className="m-status" />
        <div className="m-brand">
          <img src={logoImg} alt="" />
          <span>
            Origem <b>Conecta</b>
          </span>
        </div>
        <h1>
          Da roça<b>para a sua cozinha.</b>
        </h1>
        <p>Produtores do Piauí vendendo direto para quem cozinha.</p>
      </div>
      <section className="m-sheet">
        <h2 id="role-title">Como você vai usar?</h2>
        <div role="radiogroup" aria-labelledby="role-title">
          {ROLES.map((item) => {
            const Icon = item.icon;
            const selected = role === item.to;
            return (
              <button
                key={item.to}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`m-role${selected ? " m-on" : ""}`}
                onClick={() => setRole(item.to)}
                onDoubleClick={() => void navigate({ to: item.to })}
              >
                <span className="m-ri">
                  <Icon className="lucide" aria-hidden />
                </span>
                <div>
                  <b>{item.title}</b>
                  <span>{item.body}</span>
                </div>
                <span className="m-radio" />
              </button>
            );
          })}
        </div>
      </section>
      <div className="m-footer" style={{ border: "0", boxShadow: "none", borderRadius: "0" }}>
        <button
          type="button"
          className="m-btn m-primary"
          onClick={() => void navigate({ to: role })}
        >
          Continuar
        </button>
        <div
          style={{
            textAlign: "center",
            marginTop: "4px",
            fontSize: "14px",
            color: "var(--m-muted)",
          }}
        >
          Já tem conta?{" "}
          <Link
            to="/login"
            className="m-btn m-text"
            style={{ display: "inline-flex", height: "36px", padding: "0 4px" }}
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuthRestoring() {
  return (
    <div className="m-screen m-pad-top">
      <div className="m-card m-empty">
        <span>Restaurando sua sessão...</span>
      </div>
    </div>
  );
}
