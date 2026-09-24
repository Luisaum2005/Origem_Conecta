import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { BadgeCheck } from "@/components/mobile/icons";
import { useState, type FormEvent } from "react";
import { AuthPage, Field, FormError, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { getProfileHome, useAuth } from "@/lib/auth";
import { isValidCnpj } from "@/lib/organizations";

export const Route = createFileRoute("/signup/buyer")({
  component: SignupBuyer,
});

const TYPES = ["Restaurante", "Mercado", "Hotel", "Hortifruti", "Cozinha industrial"];
const STEPS = [
  {
    title: "Seu estabelecimento",
    subtitle: "Os produtores veem estes dados ao receber sua solicitação.",
  },
  { title: "Contato", subtitle: "Para o produtor combinar a entrega com você." },
  { title: "Endereço de entrega", subtitle: "Só os produtores do seu pedido veem este endereço." },
  { title: "Crie sua senha", subtitle: "Você entra com o e-mail e esta senha." },
];

function SignupBuyer() {
  const navigate = useNavigate();
  const router = useRouter();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [type, setType] = useState(TYPES[0]);
  const [cnpj, setCnpj] = useState("");

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
      setError("O CNPJ informado não é válido. Confira os 14 números.");
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
    const password = String(form.get("password") ?? "");
    if (password.length < 8 || password !== String(form.get("passwordConfirmation") ?? "")) {
      setError("A senha deve ter pelo menos 8 caracteres e ser repetida corretamente.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signUp({
        tipo: "comprador",
        nome: String(form.get("responsavel") ?? ""),
        email: String(form.get("email") ?? ""),
        password,
        telefone: String(form.get("telefone") ?? ""),
        cidade: String(form.get("municipio") ?? ""),
        estado: String(form.get("uf") ?? ""),
        buyer: {
          nomeEmpresa: String(form.get("nomeEmpresa") ?? ""),
          tipoEmpresa: type,
          cnpj,
          postalCode: String(form.get("cep") ?? ""),
          addressLine: String(form.get("logradouro") ?? ""),
          addressNumber: String(form.get("numero") ?? ""),
          addressComplement: String(form.get("complemento") ?? ""),
          neighborhood: String(form.get("bairro") ?? ""),
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
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
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
      screen="m-s-a5-cad-comprador"
      back={back}
      headerTitle={`Etapa ${step} de 4`}
      headerAction={
        <Link to="/" className="m-exit">
          Sair
        </Link>
      }
      steps={{ current: step, total: 4 }}
      eyebrow="Conta de comprador"
      title={STEPS[step - 1].title}
      subtitle={STEPS[step - 1].subtitle}
      footer={
        step === 1 ? (
          <button
            type="button"
            form="signup-buyer"
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
                form="signup-buyer"
                className="m-btn m-primary"
                style={{ flex: "2" }}
                onClick={(e) => next(e.currentTarget)}
              >
                Continuar
              </button>
            ) : (
              <PrimaryButton form="signup-buyer" loading={loading} style={{ flex: "2" }}>
                Criar conta
              </PrimaryButton>
            )}
          </div>
        )
      }
    >
      <form id="signup-buyer" onSubmit={onSubmit} noValidate>
        <div data-step="1" hidden={step !== 1}>
          <Field
            name="nomeEmpresa"
            label="Nome do estabelecimento"
            placeholder="Ex.: Restaurante Sabor do Campo"
            required
          />
          <div className="m-field">
            <span>Tipo</span>
            <div className="m-pills" role="radiogroup" aria-label="Tipo do estabelecimento">
              {TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={type === item}
                  className={`m-pill${type === item ? " m-on" : ""}`}
                  onClick={() => setType(item)}
                >
                  {item}
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
            name="responsavel"
            label="Responsável pelas compras"
            placeholder="Nome completo"
            autoComplete="name"
            required
          />
        </div>
        <div data-step="2" hidden={step !== 2}>
          <Field
            name="telefone"
            label="Telefone / WhatsApp"
            type="tel"
            placeholder="(86) 99999-9999"
            autoComplete="tel"
            required
          />
          <Field
            name="email"
            label="E-mail"
            type="email"
            placeholder="voce@restaurante.com.br"
            autoComplete="email"
            required
          />
        </div>
        <div data-step="3" hidden={step !== 3}>
          <AddressFields />
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
            <span>Concordo com os termos de uso e a política de privacidade.</span>
          </label>
        </div>
        <FormError>{error}</FormError>
      </form>
    </AuthPage>
  );
}
