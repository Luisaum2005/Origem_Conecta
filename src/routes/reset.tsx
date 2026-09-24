import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Mail, MessageCircle } from "@/components/mobile/icons";
import { useState } from "react";
import { AuthPage, Field, FormError, PrimaryButton } from "@/components/auth/AuthShell";
import { supportHref } from "@/lib/support";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset")({
  component: Reset,
});

function Reset() {
  const [sent, setSent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("O serviço de autenticação não está configurado.");
      return;
    }
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setLoading(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (resetError) throw resetError;
      setSent(email);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Não foi possível enviar o link. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPage
      screen="m-s-a3-redefinir"
      icon={<Mail className="lucide" aria-hidden />}
      title={sent ? "Confira seu e-mail" : "Esqueceu a senha?"}
      subtitle={
        sent
          ? `Enviamos o link para ${sent}. Ele vale por 1 hora; veja também a caixa de spam.`
          : "Informe seu e-mail. Enviamos um link para criar uma nova senha — ele vale por 1 hora."
      }
      footer={
        <>
          {sent ? (
            <Link to="/login" className="m-btn m-primary">
              Voltar para entrar
            </Link>
          ) : (
            <PrimaryButton form="reset-form" loading={loading}>
              Enviar link
            </PrimaryButton>
          )}
          {!sent && (
            <div style={{ textAlign: "center" }}>
              <Link to="/login" className="m-btn m-text">
                Voltar para entrar
              </Link>
            </div>
          )}
        </>
      }
    >
      {!sent && (
        <form id="reset-form" onSubmit={onSubmit}>
          <Field
            name="email"
            label="E-mail"
            type="email"
            placeholder="voce@restaurante.com.br"
            autoComplete="email"
            required
          />
          <FormError>{error}</FormError>
        </form>
      )}
      <a
        href={supportHref}
        target={supportHref.startsWith("http") ? "_blank" : undefined}
        rel={supportHref.startsWith("http") ? "noreferrer" : undefined}
        className="m-help m-card"
      >
        <MessageCircle className="lucide" aria-hidden />
        <div>
          <b>Não usa mais esse e-mail?</b>
          <span>Fale com o suporte pelo WhatsApp.</span>
        </div>
        <ChevronRight className="lucide" aria-hidden />
      </a>
    </AuthPage>
  );
}
