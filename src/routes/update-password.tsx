import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Circle, CircleCheck } from "@/components/mobile/icons";
import { useEffect, useState } from "react";
import { AuthPage, Field, FormError, PrimaryButton } from "@/components/auth/AuthShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/update-password")({ component: UpdatePassword });

const RULES = [
  { label: "Pelo menos 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Um número", test: (value: string) => /\d/.test(value) },
  { label: "Uma letra maiúscula", test: (value: string) => /[A-ZÀ-Ý]/.test(value) },
];
const STRENGTH = ["Fraca", "Fraca", "Média", "Boa", "Forte"];

function UpdatePassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const passed = RULES.filter((rule) => rule.test(password)).length;
  const score = password ? passed + (password.length >= 10 ? 1 : 0) : 0;
  const matches = confirmation.length > 0 && confirmation === password;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirmation) return setError("As senhas não coincidem.");
    if (!supabase) return setError("O serviço de autenticação não está configurado.");
    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    window.sessionStorage.setItem(
      "origem-conecta-auth-notice",
      "Senha atualizada. Bem-vindo de volta!",
    );
    void navigate({ to: "/" });
  };

  return (
    <AuthPage
      screen="m-s-a4-nova-senha"
      back={() => void navigate({ to: "/login" })}
      closeIcon
      title="Crie uma nova senha"
      subtitle={email ? `Para ${email}` : "Escolha uma senha segura para sua conta."}
      footer={
        <PrimaryButton form="password-form" loading={loading}>
          Salvar e entrar
        </PrimaryButton>
      }
    >
      <form id="password-form" onSubmit={onSubmit}>
        <Field
          name="password"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="m-meter" aria-label={`Força da senha: ${STRENGTH[score]}`}>
          {[1, 2, 3, 4].map((bar) => (
            <i key={bar} className={bar <= score ? "m-on" : undefined} />
          ))}
          <span>{password ? STRENGTH[score] : ""}</span>
        </div>
        <ul className="m-rules m-card">
          {RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li key={rule.label} className={ok ? "m-ok" : undefined}>
                {ok ? (
                  <CircleCheck className="lucide" aria-hidden />
                ) : (
                  <Circle className="lucide" aria-hidden />
                )}
                {rule.label}
              </li>
            );
          })}
        </ul>
        <Field
          name="confirmation"
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          reveal={false}
          end={
            matches ? (
              <Check
                className="lucide"
                aria-label="As senhas conferem"
                style={{ color: "var(--m-brand-600)" }}
              />
            ) : undefined
          }
        />
        <FormError>{error}</FormError>
      </form>
    </AuthPage>
  );
}
