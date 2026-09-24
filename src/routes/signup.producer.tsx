import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { CircleHelp, Search, UserRound, Users } from "@/components/mobile/icons";
import { useState, type FormEvent } from "react";
import { AuthPage, Field, FormError, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { SupplierProductPicker } from "@/components/forms/SupplierProductPicker";
import { getProfileHome, useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { useOrganizationDirectory } from "@/lib/organization-directory";
import { isValidCnpj } from "@/lib/organizations";

export const Route = createFileRoute("/signup/producer")({
  component: SignupProducer,
});

type Mode = "own" | "organization" | "undecided";
const MODES = [
  {
    value: "own",
    icon: UserRound,
    title: "Em nome próprio",
    body: "Com CPF, CAEPF ou nota de produtor rural",
  },
  {
    value: "organization",
    icon: Users,
    title: "Pela cooperativa ou associação",
    body: "A nota sai em nome do grupo",
  },
  {
    value: "undecided",
    icon: CircleHelp,
    title: "Ainda estou decidindo",
    body: "Você pode mudar isso depois no perfil",
  },
] as const;
const STEPS = [
  { title: "Sua propriedade", subtitle: "É assim que os compradores vão encontrar você." },
  { title: "Como você vende?", subtitle: "Isso define em nome de quem sai a nota fiscal." },
  { title: "Contato e coleta", subtitle: "Onde o comprador ou o frete busca os produtos." },
  { title: "Produtos e senha", subtitle: "Os produtos são opcionais — dá para completar depois." },
];

function SignupProducer() {
  const navigate = useNavigate();
  const router = useRouter();
  const { signUp } = useAuth();
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("undecided");
  const [orgQuery, setOrgQuery] = useState("");
  const [orgId, setOrgId] = useState("");
  const { organizations } = useOrganizationDirectory(mode === "organization" ? orgQuery : "");
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
    const cnpj = String(form.get("cnpj") ?? "");
    if (cnpj && !isValidCnpj(cnpj)) {
      setError("O CNPJ próprio não é válido. Confira os 14 números ou deixe o campo vazio.");
      setStep(2);
      return;
    }
    if (password.length < 8 || password !== String(form.get("passwordConfirmation") ?? "")) {
      setError("A senha deve ter pelo menos 8 caracteres e ser repetida corretamente.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signUp({
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
          commercializationMode: mode,
          caepf: String(form.get("caepf") ?? ""),
          stateRegistration: String(form.get("stateRegistration") ?? ""),
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
  const chosen = organizations.find((organization) => organization.id === orgId);
  const results = orgQuery.trim() ? organizations.slice(0, 3) : chosen ? [chosen] : [];

  return (
    <AuthPage
      screen="m-s-a6-cad-produtor"
      back={back}
      headerTitle={`Etapa ${step} de 4`}
      headerAction={
        <Link to="/" className="m-exit">
          Sair
        </Link>
      }
      steps={{ current: step, total: 4 }}
      eyebrow="Conta de produtor"
      title={STEPS[step - 1].title}
      subtitle={STEPS[step - 1].subtitle}
      footer={
        step === 1 ? (
          <button
            type="button"
            form="signup-producer"
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
                form="signup-producer"
                className="m-btn m-primary"
                style={{ flex: "2" }}
                onClick={(e) => next(e.currentTarget)}
              >
                Continuar
              </button>
            ) : (
              <PrimaryButton form="signup-producer" loading={loading} style={{ flex: "2" }}>
                Criar conta
              </PrimaryButton>
            )}
          </div>
        )
      }
    >
      <form id="signup-producer" onSubmit={onSubmit} noValidate>
        <div data-step="1" hidden={step !== 1}>
          <Field
            name="nomePropriedade"
            label="Nome da propriedade"
            placeholder="Ex.: Sítio das Laranjas"
            required
          />
          <Field
            name="responsavel"
            label="Responsável"
            placeholder="Nome completo"
            autoComplete="name"
            required
          />
        </div>

        <div data-step="2" hidden={step !== 2}>
          <div role="radiogroup" aria-label="Como você vende">
            {MODES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === item.value}
                  className={`m-opt${mode === item.value ? " m-on" : ""}`}
                  onClick={() => setMode(item.value)}
                >
                  <span className="m-oi">
                    <Icon className="lucide" aria-hidden />
                  </span>
                  <div>
                    <b>{item.title}</b>
                    <span>{item.body}</span>
                  </div>
                  <span className="m-radio" />
                </button>
              );
            })}
          </div>
          {mode === "own" && (
            <>
              <Field name="cnpj" label="CNPJ próprio, se tiver" placeholder="00.000.000/0000-00" />
              <Field
                name="caepf"
                label="CAEPF, se tiver"
                placeholder="Cadastro da atividade rural"
              />
              <Field
                name="stateRegistration"
                label="Inscrição estadual, se tiver"
                placeholder="Opcional agora"
              />
            </>
          )}
          {mode === "organization" && (
            <>
              <label className="m-field">
                <span>Qual cooperativa?</span>
                <div className="m-in">
                  <Search className="lucide" aria-hidden />
                  <input
                    type="search"
                    value={orgQuery}
                    onChange={(event) => setOrgQuery(event.target.value)}
                    placeholder="Nome ou cidade"
                  />
                </div>
              </label>
              {results.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  className="m-res m-card"
                  onClick={() => {
                    setOrgId(organization.id);
                    setOrgQuery("");
                  }}
                >
                  <span
                    className="m-avatar"
                    style={{ width: "36px", height: "36px", fontSize: "12px" }}
                  >
                    {initials(organization.tradeName)}
                  </span>
                  <div>
                    <b>{organization.tradeName}</b>
                    <span>
                      {organization.city} · {organization.activeMembers} produtores
                    </span>
                  </div>
                  {orgId === organization.id ? (
                    <span className="m-chip m-leaf">Selecionada</span>
                  ) : (
                    <span className="m-chip m-white">Escolher</span>
                  )}
                </button>
              ))}
              <small className="m-hint">
                O vínculo é confirmado pela própria cooperativa. Depois do cadastro, peça em Perfil
                › Cooperativas{chosen ? ` (${chosen.tradeName})` : ""}.
              </small>
            </>
          )}
        </div>

        <div data-step="3" hidden={step !== 3}>
          <Field
            name="telefone"
            label="WhatsApp"
            type="tel"
            placeholder="(86) 99999-9999"
            autoComplete="tel"
            required
          />
          <Field
            name="email"
            label="E-mail"
            type="email"
            placeholder="voce@sitio.com.br"
            autoComplete="email"
            required
          />
          <AddressFields />
        </div>

        <div data-step="4" hidden={step !== 4}>
          <div className="m-field">
            <span>O que você produz</span>
            <div className="m-legacy">
              <SupplierProductPicker value={picked} onChange={setPicked} />
            </div>
          </div>
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
        </div>
        <FormError>{error}</FormError>
      </form>
    </AuthPage>
  );
}
