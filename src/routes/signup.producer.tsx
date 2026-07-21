import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { FormProgress, FormSection } from "@/components/forms/FormSection";
import { SupplierProductPicker } from "@/components/forms/SupplierProductPicker";
import { getProfileHome, useAuth } from "@/lib/auth";
import { isValidCnpj } from "@/lib/organizations";
import { useEffect, useRef, useState, type FormEvent } from "react";

export const Route = createFileRoute("/signup/producer")({
  component: SignupProducer,
});

function SignupProducer() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [picked, setPicked] = useState<string[]>([]);
  const [commercializationMode, setCommercializationMode] = useState<
    "own" | "organization" | "undecided"
  >("undecided");
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
    if (targetStep === 3 && picked.length === 0) {
      setError("Selecione pelo menos um produto antes de continuar.");
      return false;
    }
    setError("");
    return true;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (picked.length === 0) {
      setError("Selecione pelo menos um produto que você produz ou fornece.");
      return;
    }
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const cnpj = String(form.get("cnpj") ?? "");
    if (cnpj && !isValidCnpj(cnpj)) {
      setError("O CNPJ próprio não é válido. Confira os 14 números ou deixe o campo vazio.");
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
        tipo: "produtor",
        nome: String(form.get("responsavel") ?? ""),
        email: String(form.get("email") ?? ""),
        password,
        telefone: String(form.get("telefone") ?? ""),
        cidade: String(form.get("municipio") ?? ""),
        estado: String(form.get("uf") ?? ""),
        producer: {
          nomePropriedade: String(form.get("nomePropriedade") ?? ""),
          responsavel: String(form.get("responsavel") ?? ""),
          cnpj,
          produtos: picked,
          commercializationMode,
          caepf: String(form.get("caepf") ?? ""),
          stateRegistration: String(form.get("stateRegistration") ?? ""),
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
      title="Criar conta · Produtor"
      subtitle="Conte sobre sua produção. Leva menos de 3 minutos, sem burocracia."
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
          <FormSection title="Dados da propriedade">
            <Field
              name="nomePropriedade"
              label="Nome da propriedade"
              placeholder="Digite o nome da propriedade"
              required
            />
            <Field
              name="responsavel"
              label="Responsável"
              placeholder="Digite o nome completo"
              required
            />
          </FormSection>

          <FormSection
            title="Como você pretende comercializar?"
            caption="Isso informa ao comprador como a negociação será conduzida"
          >
            <div className="grid gap-2">
              {(
                [
                  ["own", "Em nome próprio", "Tenho ou informarei minha documentação própria."],
                  [
                    "organization",
                    "Por cooperativa ou associação",
                    "Solicitarei vínculo com uma organização após o cadastro.",
                  ],
                  [
                    "undecided",
                    "Ainda estou definindo",
                    "Poderei divulgar minha produção e completar isso posteriormente.",
                  ],
                ] as const
              ).map(([value, title, description]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border p-4 ${
                    commercializationMode === value
                      ? "border-leaf-600 bg-leaf-100"
                      : "border-border bg-white"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="commercializationMode"
                      value={value}
                      checked={commercializationMode === value}
                      onChange={() => setCommercializationMode(value)}
                      className="mt-1 h-4 w-4 accent-[var(--color-brand-900)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-brand-900">{title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {commercializationMode === "own" && (
              <div className="mt-4 grid gap-4">
                <Field name="cnpj" label="CNPJ próprio, se possuir" placeholder="Digite o CNPJ" />
                <Field
                  name="caepf"
                  label="CAEPF, se aplicável"
                  placeholder="Cadastro da atividade rural"
                  helper="Use somente se você já possui esse cadastro de produtor rural."
                />
                <Field
                  name="stateRegistration"
                  label="Inscrição estadual, se aplicável"
                  placeholder="Digite a inscrição estadual"
                  helper="Número estadual usado para emissão de documentos fiscais, quando aplicável."
                />
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Não informe o CNPJ de uma cooperativa neste cadastro. O vínculo será confirmado pela
              própria organização.
            </p>
          </FormSection>
        </div>

        <div data-step="2" className={step === 2 ? "space-y-6" : "hidden"}>
          <FormSection title="Contato">
            <Field
              name="telefone"
              label="WhatsApp"
              type="tel"
              placeholder="Digite o telefone"
              required
            />
            <Field name="email" label="E-mail" type="email" required />
          </FormSection>

          <AddressFields />
        </div>

        <div data-step="3" className={step === 3 ? "space-y-6" : "hidden"}>
          <FormSection title="O que você produz" caption="Selecione tudo que fornece">
            <SupplierProductPicker value={picked} onChange={setPicked} required />
          </FormSection>
        </div>

        <div data-step="4" className={step === 4 ? "space-y-6" : "hidden"}>
          <FormSection title="Segurança">
            <Field
              name="password"
              label="Senha"
              type="password"
              helper="Mínimo 8 caracteres"
              minLength={8}
              required
            />
            <Field
              name="passwordConfirmation"
              label="Repita a senha"
              type="password"
              minLength={8}
              required
            />
          </FormSection>
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
            <PrimaryButton loading={loading}>Criar conta de produtor</PrimaryButton>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
