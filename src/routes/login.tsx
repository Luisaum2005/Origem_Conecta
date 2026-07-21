import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, FormError, PrimaryButton } from "@/components/auth/AuthShell";
import { getProfileHome, useAuth } from "@/lib/auth";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { signIn, isSupabaseConfigured, profile, loading: restoringSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (restoringSession) {
    return (
      <AuthLayout title="Restaurando sua sessão" subtitle="Aguarde um instante...">
        <p className="text-sm text-muted-foreground">Validando o acesso salvo neste dispositivo.</p>
      </AuthLayout>
    );
  }
  if (profile) return <Navigate to={getProfileHome(profile.tipo)} replace />;

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
      title="Entrar na Origem Conecta"
      subtitle="Acesse sua conta para acompanhar portfólio, pedidos, solicitações e estoque."
      footer={
        <div className="space-y-3">
          <p className="font-medium text-brand-900">Ainda não possui uma conta?</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link to="/signup/buyer" className="font-semibold text-brand-900 hover:underline">
              Sou comprador
            </Link>
            <Link to="/signup/producer" className="font-semibold text-brand-900 hover:underline">
              Sou produtor
            </Link>
            <Link
              to="/signup/organization"
              className="font-semibold text-brand-900 hover:underline"
            >
              Represento uma cooperativa ou associação
            </Link>
          </div>
        </div>
      }
    >
      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Modo local ativo. Use qualquer e-mail e senha para testar. E-mails com "produtor" entram
          como produtor; os demais entram como comprador.
        </div>
      )}
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field
          name="email"
          label="E-mail"
          type="email"
          placeholder="voce@empresa.com.br"
          autoComplete="email"
          required
        />
        <Field
          name="password"
          label="Senha"
          type="password"
          placeholder="Digite sua senha"
          autoComplete="current-password"
          required
        />
        <div className="flex justify-end">
          <Link to="/reset" className="text-sm font-medium text-brand-700 hover:underline">
            Esqueci a senha
          </Link>
        </div>
        <FormError>{error}</FormError>
        <PrimaryButton loading={loading}>Entrar</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
