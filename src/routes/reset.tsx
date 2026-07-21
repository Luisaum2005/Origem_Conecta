import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

export const Route = createFileRoute("/reset")({
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("O serviço de autenticação não está configurado.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setLoading(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
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
    <AuthLayout
      title="Redefinir senha"
      subtitle="Enviaremos um link de redefinição para seu e-mail."
    >
      {sent ? (
        <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--color-success-bg)] p-5">
          <p className="font-semibold text-[var(--color-success-fg)]">
            Pronto. Verifique seu e-mail.
          </p>
          <p className="mt-1 text-sm text-[var(--color-success-fg)]/80">
            O link expira em 30 minutos.
          </p>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-brand-900"
          >
            Voltar ao login
          </button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={onSubmit}>
          <Field
            name="email"
            label="E-mail"
            type="email"
            placeholder="voce@restaurante.com"
            required
          />
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <PrimaryButton loading={loading}>Enviar link</PrimaryButton>
        </form>
      )}
    </AuthLayout>
  );
}
