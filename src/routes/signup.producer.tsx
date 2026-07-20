import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { FormProgress, FormSection } from "@/components/forms/FormSection";
import { SupplierProductPicker } from "@/components/forms/SupplierProductPicker";
import { getProfileHome, useAuth } from "@/lib/auth";
import { useState, type FormEvent } from "react";

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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (picked.length === 0) {
      setError("Selecione pelo menos um produto que você produz ou fornece.");
      return;
    }
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const profile = await signUp({
        tipo: "produtor",
        nome: String(form.get("responsavel") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        telefone: String(form.get("telefone") ?? ""),
        cidade: String(form.get("municipio") ?? ""),
        estado: String(form.get("uf") ?? ""),
        producer: {
          nomePropriedade: String(form.get("nomePropriedade") ?? ""),
          responsavel: String(form.get("responsavel") ?? ""),
          cnpj: String(form.get("cnpj") ?? ""),
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
      <FormProgress step={1} total={4} hint="Você pode ajustar depois" />
      <form className="space-y-6" onSubmit={onSubmit}>
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
                    <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          {commercializationMode === "own" && (
            <div className="mt-4 grid gap-4">
              <Field name="cnpj" label="CNPJ próprio, se possuir" placeholder="Digite o CNPJ" />
              <Field name="caepf" label="CAEPF, se aplicável" placeholder="Digite o CAEPF" />
              <Field
                name="stateRegistration"
                label="Inscrição estadual, se aplicável"
                placeholder="Digite a inscrição estadual"
              />
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Não informe o CNPJ de uma cooperativa neste cadastro. O vínculo será confirmado pela
            própria organização.
          </p>
        </FormSection>

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

        <FormSection title="O que você produz" caption="Selecione tudo que fornece">
          <SupplierProductPicker value={picked} onChange={setPicked} required />
        </FormSection>

        <FormSection title="Segurança">
          <Field
            name="password"
            label="Senha"
            type="password"
            helper="Mínimo 8 caracteres"
            required
          />
        </FormSection>

        {error && (
          <p className="rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
            {error}
          </p>
        )}
        <PrimaryButton loading={loading}>Criar conta de produtor</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
