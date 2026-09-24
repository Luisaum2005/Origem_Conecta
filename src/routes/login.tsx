import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, FormError, PrimaryButton } from "@/components/auth/AuthShell";
import { getProfileHome, useAuth } from "@/lib/auth";
import { useEffect, useState, type FormEvent } from "react";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { signIn, isDemoMode, profile, loading: restoringSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const message = window.sessionStorage.getItem("origem-conecta-auth-notice") ?? "";
    window.sessionStorage.removeItem("origem-conecta-auth-notice");
    setNotice(message);
  }, []);

  if (restoringSession) {
    return (
      <AuthLayout
        title="Restaurando sua sessão"
        subtitle="Validando o acesso salvo neste aparelho."
      >
        <span />
      </AuthLayout>
    );
  }
  if (profile) return <Navigate to={getProfileHome(profile.tipo, profile.roles)} replace />;

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
      navigate({ to: getProfileHome(profile.tipo, profile.roles) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Use o e-mail do seu cadastro."
      footer={
        <>
          Novo por aqui? <Link to="/">Criar conta</Link>
        </>
      }
    >
      {isDemoMode && (
        <p className="m-notice m-warn">
          Ambiente de demonstração: os dados ficam só neste navegador. E-mails com "produtor" entram
          como produtor; os demais, como comprador.
        </p>
      )}
      {notice && (
        <p role="status" className="m-notice">
          {notice}
        </p>
      )}
      <form onSubmit={onSubmit}>
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
        <div className="m-forgot">
          <Link to="/reset" className="m-btn m-text m-sm" style={{ padding: "0 4px" }}>
            Esqueci a senha
          </Link>
        </div>
        <FormError>{error}</FormError>
        <PrimaryButton loading={loading} style={{ marginTop: "6px" }}>
          Entrar
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
