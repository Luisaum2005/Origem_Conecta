import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { FormSection } from "@/components/forms/FormSection";
import { getProfileHome, useAuth } from "@/lib/auth";
import { isValidCnpj } from "@/lib/organizations";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/signup/organization")({ component: SignupOrganization });

function SignupOrganization() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [alsoProducer, setAlsoProducer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const responsible = String(form.get("responsavel") ?? "");
    const cnpj = String(form.get("cnpj") ?? "");
    if (!isValidCnpj(cnpj)) {
      setError("Informe um CNPJ válido.");
      setLoading(false);
      return;
    }
    try {
      const profile = await signUp({
        tipo: alsoProducer ? "produtor" : "organizacao",
        nome: responsible,
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        telefone: String(form.get("telefone") ?? ""),
        cidade: String(form.get("municipio") ?? ""),
        estado: String(form.get("uf") ?? ""),
        producer: alsoProducer
          ? {
              nomePropriedade: String(form.get("nomePropriedade") ?? ""),
              responsavel: responsible,
              cnpj: "",
              produtos: [],
              commercializationMode: "organization",
            }
          : undefined,
        organization: {
          type: form.get("tipoOrganizacao") as "cooperativa" | "associacao",
          legalName: String(form.get("razaoSocial") ?? ""),
          tradeName: String(form.get("nomeFantasia") ?? ""),
          cnpj,
          stateRegistration: String(form.get("inscricaoEstadual") ?? ""),
          phone: String(form.get("telefone") ?? ""),
          addressLine: String(form.get("logradouro") ?? ""),
          addressNumber: String(form.get("numero") ?? ""),
          addressComplement: String(form.get("complemento") ?? ""),
          neighborhood: String(form.get("bairro") ?? ""),
          postalCode: String(form.get("cep") ?? ""),
          responsibleName: responsible,
          responsibleRole: String(form.get("cargo") ?? ""),
        },
      });
      navigate({ to: getProfileHome(profile.tipo) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a organização.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout
      title="Cadastrar cooperativa ou associação"
      subtitle="Cadastre a instituição e o responsável pela gestão na Origem Conecta."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-brand-900 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form className="space-y-6" onSubmit={onSubmit}>
        <FormSection title="Dados institucionais">
          <label className="block">
            <span className="block text-sm font-medium text-brand-900">Tipo da organização</span>
            <select
              name="tipoOrganizacao"
              required
              className="mt-2 h-[52px] w-full rounded-xl border border-border bg-white px-4"
            >
              <option value="cooperativa">Cooperativa</option>
              <option value="associacao">Associação</option>
            </select>
          </label>
          <Field name="razaoSocial" label="Razão social" required />
          <Field name="nomeFantasia" label="Nome fantasia" required />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" required />
            <Field name="inscricaoEstadual" label="Inscrição estadual" />
          </div>
        </FormSection>
        <FormSection title="Responsável">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="responsavel" label="Nome completo" required />
            <Field name="cargo" label="Cargo" placeholder="Presidente, diretor..." required />
          </div>
          <Field name="telefone" label="Telefone/WhatsApp" type="tel" required />
          <Field name="email" label="E-mail de acesso" type="email" autoComplete="email" required />
        </FormSection>
        <AddressFields />
        <FormSection title="Produção própria">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={alsoProducer}
              onChange={(event) => setAlsoProducer(event.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--color-brand-900)]"
            />
            <span>
              <span className="block text-sm font-semibold text-brand-900">
                Também sou produtor
              </span>
              <span className="text-xs text-muted-foreground">
                Cria o perfil de produção na mesma conta, sem outro login.
              </span>
            </span>
          </label>
          {alsoProducer && <Field name="nomePropriedade" label="Nome da propriedade" required />}
        </FormSection>
        <FormSection title="Segurança">
          <Field
            name="password"
            label="Senha"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </FormSection>
        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            required
            className="mt-1 h-5 w-5 accent-[var(--color-brand-900)]"
          />
          <span>
            Confirmo que sou autorizado a cadastrar esta organização e concordo com os termos de
            uso.
          </span>
        </label>
        {error && (
          <p className="rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
            {error}
          </p>
        )}
        <PrimaryButton loading={loading}>Enviar cadastro para análise</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
