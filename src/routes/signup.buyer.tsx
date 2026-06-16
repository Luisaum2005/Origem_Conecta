import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { FormProgress, FormSection } from "@/components/forms/FormSection";
import { getProfileHome, useAuth } from "@/lib/auth";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/signup/buyer")({
  component: SignupBuyer,
});

function SignupBuyer() {
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
        tipo: "comprador",
        nome: String(form.get("responsavel") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        telefone: String(form.get("telefone") ?? ""),
        cidade: String(form.get("municipio") ?? ""),
        estado: String(form.get("uf") ?? ""),
        buyer: {
          nomeEmpresa: String(form.get("nomeEmpresa") ?? ""),
          tipoEmpresa: "Restaurante",
          cnpj: String(form.get("cnpj") ?? ""),
        },
      });
      navigate({ to: getProfileHome(profile.tipo) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Criar conta de comprador"
      subtitle="Para restaurantes, mercados, hotéis e cozinhas que compram direto de produtores."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-brand-900 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <FormProgress step={1} total={4} hint="Leva menos de 3 minutos" />
      <form className="space-y-6" onSubmit={onSubmit}>
        <FormSection title="Dados do estabelecimento">
          <Field
            name="nomeEmpresa"
            label="Nome do estabelecimento"
            placeholder="Ex: Mercado Central"
            required
          />
          <Field name="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" required />
        </FormSection>

        <FormSection title="Contato">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              name="responsavel"
              label="Responsável"
              placeholder="Nome completo"
              autoComplete="name"
              required
            />
            <Field
              name="telefone"
              label="Telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              required
            />
          </div>
          <Field name="email" label="E-mail" type="email" autoComplete="email" required />
        </FormSection>

        <AddressFields />

        <FormSection title="Segurança">
          <Field
            name="password"
            label="Senha"
            type="password"
            helper="Mínimo 8 caracteres"
            autoComplete="new-password"
            required
          />
        </FormSection>

        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded-md border-border accent-[var(--color-brand-900)]"
            required
          />
          <span>Concordo com os termos de uso e política de privacidade.</span>
        </label>
        {error && (
          <p className="rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
            {error}
          </p>
        )}
        <PrimaryButton loading={loading}>Criar conta</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
