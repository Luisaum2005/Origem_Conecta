import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { BadgeCheck } from "@/components/mobile/icons";
import { useState, type FormEvent } from "react";
import { AuthPage, Field, FormError, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { getProfileHome, useAuth } from "@/lib/auth";
import { isValidCnpj } from "@/lib/organizations";

export const Route = createFileRoute("/signup/organization")({ component: SignupOrganization });

const STEPS = [
  {
    title: "Dados da organização",
    subtitle: "Conferimos o CNPJ na Receita antes de liberar as vendas.",
  },
  { title: "Responsável", subtitle: "Quem administra a organização no Origem Conecta." },
  {
    title: "Endereço e unidade",
    subtitle: "A mesma conta também vende como produtor, sem outro cadastro.",
  },
  { title: "Crie sua senha", subtitle: "Você entra com o e-mail e esta senha." },
];

function SignupOrganization() {
  const navigate = useNavigate();
  const router = useRouter();
  const { signUp } = useAuth();
  const [type, setType] = useState<"cooperativa" | "associacao">("cooperativa");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const validateStep = (form: HTMLFormElement | null, target = step) => {
    if (!form) return false;
    const fields = form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      `[data-step="${target}"] input, [data-step="${target}"] select`,
    );
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    if (target === 1 && !isValidCnpj(cnpj)) {
      setError("Informe um CNPJ válido.");
      return false;
    }
    setError("");
    return true;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    for (let current = 1; current <= 4; current += 1) {
      if (!validateStep(formElement, current)) {
        setStep(current);
        return;
      }
    }
    const form = new FormData(formElement);
    const responsible = String(form.get("responsavel") ?? "");
    const password = String(form.get("password") ?? "");
    if (password.length < 8 || password !== String(form.get("passwordConfirmation") ?? "")) {
      setError("A senha deve ter pelo menos 8 caracteres e ser repetida corretamente.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signUp({
        tipo: "produtor",
        nome: responsible,
        email: String(form.get("email") ?? ""),
        password,
        telefone: String(form.get("telefone") ?? ""),
        cidade: String(form.get("municipio") ?? ""),
        estado: String(form.get("uf") ?? ""),
        producer: {
          nomePropriedade: String(form.get("nomePropriedade") ?? ""),
          responsavel: responsible,
          cnpj: "",
          produtos: [],
          commercializationMode: "organization",
        },
        organization: {
          type,
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
      if (result.requiresEmailConfirmation) {
        window.sessionStorage.setItem(
          "origem-conecta-auth-notice",
          "Cadastro concluído. Confirme o e-mail recebido antes de entrar.",
        );
        void navigate({ to: "/login" });
      } else if (result.profile) {
        void navigate({ to: getProfileHome(result.profile.tipo, result.profile.roles) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a organização.");
    } finally {
      setLoading(false);
    }
  };

  const next = (button: HTMLButtonElement) => {
    if (validateStep(button.form)) setStep((current) => current + 1);
  };
  const back = () => {
    if (step > 1) setStep((current) => current - 1);
    else if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/" });
  };

  return (
    <AuthPage
      screen="m-s-a7-cad-cooperativa"
      back={back}
      headerTitle={`Etapa ${step} de 4`}
      headerAction={
        <Link to="/" className="m-exit">
          Sair
        </Link>
      }
      steps={{ current: step, total: 4 }}
      eyebrow="Cooperativa ou associação"
      title={STEPS[step - 1].title}
      subtitle={STEPS[step - 1].subtitle}
      footer={
        step === 1 ? (
          <button
            type="button"
            form="signup-org"
            className="m-btn m-primary"
            onClick={(e) => next(e.currentTarget)}
          >
            Continuar
          </button>
        ) : (
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="m-btn m-secondary"
              style={{ flex: "1" }}
              onClick={back}
            >
              Voltar
            </button>
            {step < 4 ? (
              <button
                type="button"
                form="signup-org"
                className="m-btn m-primary"
                style={{ flex: "2" }}
                onClick={(e) => next(e.currentTarget)}
              >
                Continuar
              </button>
            ) : (
              <PrimaryButton form="signup-org" loading={loading} style={{ flex: "2" }}>
                Criar conta
              </PrimaryButton>
            )}
          </div>
        )
      }
    >
      <form id="signup-org" onSubmit={onSubmit} noValidate>
        <div data-step="1" hidden={step !== 1}>
          <div className="m-field">
            <span>Tipo</span>
            <div className="m-seg" role="radiogroup" aria-label="Tipo da organização">
              {(
                [
                  ["cooperativa", "Cooperativa"],
                  ["associacao", "Associação"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={type === value}
                  className={type === value ? "m-on" : undefined}
                  onClick={() => setType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Field
            name="cnpj"
            label="CNPJ"
            placeholder="00.000.000/0000-00"
            required
            value={cnpj}
            onChange={(event) => setCnpj(event.target.value)}
            helper={
              isValidCnpj(cnpj) ? (
                <span className="m-ok">
                  <BadgeCheck className="lucide" aria-hidden />
                  CNPJ válido
                </span>
              ) : undefined
            }
          />
          <Field
            name="nomeFantasia"
            label="Nome fantasia"
            placeholder="Ex.: Coop. Agro Piauí"
            required
          />
          <Field name="razaoSocial" label="Razão social" placeholder="Como está no CNPJ" required />
          <Field
            name="inscricaoEstadual"
            label="Inscrição estadual"
            placeholder="Opcional agora"
            helper="Necessária para emitir nota fiscal de venda."
          />
        </div>
        <div data-step="2" hidden={step !== 2}>
          <Field name="responsavel" label="Nome completo" autoComplete="name" required />
          <Field name="cargo" label="Cargo" placeholder="Presidente, diretor..." required />
          <Field
            name="telefone"
            label="Telefone / WhatsApp"
            type="tel"
            placeholder="(86) 99999-9999"
            required
          />
          <Field name="email" label="E-mail de acesso" type="email" autoComplete="email" required />
        </div>
        <div data-step="3" hidden={step !== 3}>
          <AddressFields />
          <Field
            name="nomePropriedade"
            label="Unidade produtiva"
            placeholder="Sede, fazenda ou unidade que publica os produtos"
            required
          />
        </div>
        <div data-step="4" hidden={step !== 4}>
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
            autoComplete="new-password"
            minLength={8}
            required
          />
          <label className="m-terms">
            <input type="checkbox" required />
            <span>
              Confirmo que posso cadastrar esta organização e concordo com os termos de uso.
            </span>
          </label>
        </div>
        <FormError>{error}</FormError>
      </form>
    </AuthPage>
  );
}
