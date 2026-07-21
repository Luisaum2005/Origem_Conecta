import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { supabase } from "@/lib/supabase";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/update-password")({ component: UpdatePassword });

function UpdatePassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirmation) return setError("As senhas não coincidem.");
    if (!supabase) return setError("O serviço de autenticação não está configurado.");

    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    setUpdated(true);
  };

  return (
    <AuthLayout title="Criar nova senha" subtitle="Escolha uma senha segura para sua conta.">
      {updated ? (
        <div className="space-y-4">
          <p className="text-[var(--color-success-fg)]" role="status">
            Senha atualizada com sucesso.
          </p>
          <button
            className="h-[52px] w-full rounded-xl bg-brand-900 font-semibold text-white"
            onClick={() => navigate({ to: "/login" })}
          >
            Entrar
          </button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={onSubmit}>
          <Field name="password" label="Nova senha" type="password" minLength={8} required />
          <Field
            name="confirmation"
            label="Confirmar nova senha"
            type="password"
            minLength={8}
            required
          />
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <PrimaryButton loading={loading}>Salvar nova senha</PrimaryButton>
        </form>
      )}
    </AuthLayout>
  );
}
