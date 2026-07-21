import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { FormProgress, FormSection } from "@/components/forms/FormSection";
import { getProfileHome, useAuth } from "@/lib/auth";
import { isValidCnpj } from "@/lib/organizations";
import { useEffect, useRef, useState, type FormEvent } from "react";

export const Route = createFileRoute("/signup/buyer")({
  component: SignupBuyer,
});

function SignupBuyer() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
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
    for (let current = 1; current <= 4; current += 1) {
      if (!validateStep(event.currentTarget, current)) {
        setStep(current);
        return;
      }
    }
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (!isValidCnpj(String(form.get("cnpj") ?? ""))) {
      setError("O CNPJ informado não é válido. Confira os 14 números.");
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
        tipo: "comprador",
        nome: String(form.get("responsavel") ?? ""),
        email: String(form.get("email") ?? ""),
        password,
        telefone: String(form.get("telefone") ?? ""),
        cidade: String(form.get("municipio") ?? ""),
        estado: String(form.get("uf") ?? ""),
        buyer: {
          nomeEmpresa: String(form.get("nomeEmpresa") ?? ""),
          tipoEmpresa: String(form.get("tipoEmpresa") ?? ""),
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
      <FormProgress step={step} total={4} hint="Seus dados ficam preservados ao avançar" />
      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        <div data-step="1" className={step === 1 ? "space-y-6" : "hidden"}>
          <FormSection title="Dados do estabelecimento">
            <Field
              name="nomeEmpresa"
              label="Nome do estabelecimento"
              placeholder="Ex: Mercado Central"
              required
            />
            <label className="block">
              <span className="block text-sm font-medium text-brand-900">
                Tipo do estabelecimento <span className="ml-1 text-orange-600">*</span>
              </span>
              <select
                name="tipoEmpresa"
                required
                className="mt-2 h-[52px] w-full rounded-xl border border-border bg-white px-4 text-base text-brand-900 focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
              >
                <option value="Supermercado">Supermercado</option>
                <option value="Restaurante">Restaurante</option>
                <option value="Quitanda / Sacolão">Quitanda / Sacolão</option>
                <option value="Hotel">Hotel</option>
                <option value="Cozinha Industrial">Cozinha Industrial</option>
                <option value="Outro">Outro</option>
              </select>
            </label>
            <Field
              name="cnpj"
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              helper="Cadastro da empresa que realizará as negociações na plataforma."
              required
            />
          </FormSection>
        </div>

        <div data-step="2" className={step === 2 ? "space-y-6" : "hidden"}>
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
        </div>

        <div data-step="3" className={step === 3 ? "space-y-6" : "hidden"}>
          <AddressFields />
        </div>

        <div data-step="4" className={step === 4 ? "space-y-6" : "hidden"}>
          <FormSection title="Segurança">
            <Field
              name="password"
              label="Senha"
              type="password"
              helper="Mínimo 8 caracteres"
              autoComplete="new-password"
              minLength={8}
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
              className="mt-1 h-5 w-5 rounded-md border-border accent-[var(--color-brand-900)]"
              required
            />
            <span>Concordo com os termos de uso e política de privacidade.</span>
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
            <PrimaryButton loading={loading}>Criar conta</PrimaryButton>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
