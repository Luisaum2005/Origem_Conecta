import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { FormProgress, FormSection } from "@/components/forms/FormSection";
import { getProfileHome, useAuth } from "@/lib/auth";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/signup/admin")({
  component: SignupAdmin,
});

function SignupAdmin() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const profile = await signUp({
        tipo: "admin",
        nome: String(form.get("nome") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        telefone: String(form.get("telefone") ?? ""),
        adminInviteCode: String(form.get("adminInviteCode") ?? ""),
      });
      navigate({ to: getProfileHome(profile.tipo) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar o admin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Criar admin Origem"
      subtitle="Acesso restrito para operacao interna. Esta tela exige codigo de convite."
      footer={
        <>
          Ja tem conta?{" "}
          <Link to="/login" className="font-semibold text-brand-900 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <FormProgress step={1} total={1} hint="Acesso interno" />
      <form className="space-y-6" onSubmit={onSubmit}>
        <FormSection title="Dados do admin">
          <Field name="nome" label="Nome" placeholder="Admin Origem" required />
          <Field name="telefone" label="Telefone" type="tel" placeholder="(11) 99999-9999" />
          <Field name="email" label="E-mail" type="email" required />
        </FormSection>

        <FormSection title="Seguranca">
          <Field
            name="adminInviteCode"
            label="Codigo de convite"
            type="password"
            helper="Use o codigo configurado em VITE_ADMIN_INVITE_CODE."
            required
          />
          <Field
            name="password"
            label="Senha"
            type="password"
            helper="Minimo 8 caracteres"
            required
          />
        </FormSection>

        {error && (
          <p className="rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
            {error}
          </p>
        )}
        <PrimaryButton loading={loading}>Criar admin</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
