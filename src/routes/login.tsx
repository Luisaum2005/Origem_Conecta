import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { getProfileHome, useAuth } from "@/lib/auth";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { signIn, isSupabaseConfigured } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const profile = await signIn({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      navigate({ to: getProfileHome(profile.tipo) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Acesse sua conta para ver o portfólio da semana."
      footer={
        <>
          Novo por aqui?{" "}
          <Link to="/signup/buyer" className="font-semibold text-brand-900 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Modo local ativo. Use qualquer e-mail e senha para testar. E-mails com "produtor" entram
          como produtor; com "admin", como admin.
        </div>
      )}
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field
          name="email"
          label="E-mail"
          type="email"
          placeholder="voce@restaurante.com"
          required
        />
        <Field name="password" label="Senha" type="password" placeholder="••••••••" required />
        <div className="flex justify-end">
          <Link to="/reset" className="text-sm font-medium text-brand-700 hover:underline">
            Esqueci a senha
          </Link>
        </div>
        {error && (
          <p className="rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
            {error}
          </p>
        )}
        <PrimaryButton loading={loading}>Entrar</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
