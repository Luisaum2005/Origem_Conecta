import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { FormProgress, FormSection } from "@/components/forms/FormSection";
import { getProfileHome, useAuth } from "@/lib/auth";
import { isValidCnpj } from "@/lib/organizations";
import { useEffect, useRef, useState, type FormEvent } from "react";

export const Route = createFileRoute("/signup/organization")({ component: SignupOrganization });

function SignupOrganization() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [alsoProducer, setAlsoProducer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const validateStep = (form: HTMLFormElement, targetStep = step) => {
    const fields = form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      `[data-step="${targetStep}"] input, [data-step="${targetStep}"] select`,
    );
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  };
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const responsible = String(form.get("responsavel") ?? "");
    const cnpj = String(form.get("cnpj") ?? "");
    const password = String(form.get("password") ?? "");
    if (!isValidCnpj(cnpj)) {
      setError("Informe um CNPJ válido.");
      setLoading(false);
      return;
    }
    if (password.length < 8 || password !== String(form.get("passwordConfirmation") ?? "")) {
      setError("A senha deve ter pelo menos 8 caracteres e ser repetida corretamente.");
      setLoading(false);
      return;
    }
    try {
      const profile = await signUp({
        tipo: alsoProducer ? "produtor" : "organizacao",
        nome: responsible,
        email: String(form.get("email") ?? ""),
        password,
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
      <FormProgress step={step} total={4} hint="Você pode voltar sem perder os dados" />
      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        <div data-step="1" className={step === 1 ? "space-y-6" : "hidden"}>
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
              <Field
                name="cnpj"
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                helper="Informe os 14 números registrados para a organização."
                required
              />
              <Field
                name="inscricaoEstadual"
                label="Inscrição estadual"
                helper="Preencha apenas se a organização possuir inscrição estadual."
              />
            </div>
          </FormSection>
        </div>
        <div data-step="2" className={step === 2 ? "space-y-6" : "hidden"}>
          <FormSection title="Responsável">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="responsavel" label="Nome completo" required />
              <Field name="cargo" label="Cargo" placeholder="Presidente, diretor..." required />
            </div>
            <Field name="telefone" label="Telefone/WhatsApp" type="tel" required />
            <Field
              name="email"
              label="E-mail de acesso"
              type="email"
              autoComplete="email"
              required
            />
          </FormSection>
        </div>
        <div data-step="3" className={step === 3 ? "space-y-6" : "hidden"}>
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
        </div>
        <div data-step="4" className={step === 4 ? "space-y-6" : "hidden"}>
          <FormSection title="Segurança">
            <Field
              name="password"
              label="Senha"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
            <Field
              name="passwordConfirmation"
              label="Repita a senha"
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
        </div>
        {error && (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]"
          >
            {error}
          </p>
        )}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((current) => current - 1)}
              className="h-[52px] flex-1 rounded-xl border border-border bg-white font-semibold text-brand-900"
            >
              Voltar
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form && validateStep(form)) setStep((current) => current + 1);
              }}
              className="h-[52px] flex-1 rounded-xl bg-brand-900 font-semibold text-white"
            >
              Continuar
            </button>
          ) : (
            <PrimaryButton loading={loading}>Criar organização</PrimaryButton>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
