import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field, PrimaryButton } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import { FormProgress, FormSection } from "@/components/forms/FormSection";
import { getProfileHome, useAuth } from "@/lib/auth";
import { SUPPLIER_PRODUCT_GROUPS } from "@/lib/hortifruti";
import { useMemo, useState, type FormEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export const Route = createFileRoute("/signup/producer")({
  component: SignupProducer,
});

function SignupProducer() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
            placeholder="Sítio Esperança"
            required
          />
          <Field name="responsavel" label="Responsável" placeholder="Nome completo" required />
          <Field name="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" required />
        </FormSection>

        <FormSection title="Contato">
          <Field
            name="telefone"
            label="WhatsApp"
            type="tel"
            placeholder="(11) 99999-9999"
            required
          />
          <Field name="email" label="E-mail" type="email" required />
        </FormSection>

        <AddressFields />

        <FormSection title="O que você produz" caption="Selecione tudo que fornece">
          <ProductPicker picked={picked} setPicked={setPicked} />
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

function ProductPicker({
  picked,
  setPicked,
}: {
  picked: string[];
  setPicked: (s: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPPLIER_PRODUCT_GROUPS;
    return SUPPLIER_PRODUCT_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.toLowerCase().includes(q)),
    })).filter((g) => g.items.length);
  }, [query]);

  const toggle = (p: string) =>
    setPicked(picked.includes(p) ? picked.filter((x) => x !== p) : [...picked, p]);

  return (
    <div>
      <span className="block text-sm font-medium text-brand-900">
        O que você produz ou fornece? <span className="ml-1 text-orange-600">*</span>
      </span>

      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-left text-sm text-brand-900 hover:border-leaf-500"
      >
        <span className="truncate text-muted-foreground">
          {picked.length === 0
            ? "Selecione os produtos que você fornece"
            : `${picked.length} produto${picked.length > 1 ? "s" : ""} selecionado${picked.length > 1 ? "s" : ""}`}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {picked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {picked.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1.5 rounded-full bg-leaf-100 px-3 py-1 text-xs font-medium text-brand-900"
            >
              {p}
              <button type="button" onClick={() => toggle(p)} className="hover:text-orange-600">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 rounded-2xl border border-border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="h-9 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-2">
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado.
              </p>
            )}
            {filtered.map((g) => (
              <div key={g.group} className="px-2 py-1">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.group}
                </p>
                <ul>
                  {g.items.map((p) => {
                    const active = picked.includes(p);
                    return (
                      <li key={p}>
                        <button
                          type="button"
                          onClick={() => toggle(p)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                            active ? "bg-leaf-100 text-brand-900" : "text-brand-900 hover:bg-canvas"
                          }`}
                        >
                          <span>{p}</span>
                          {active && <Check className="h-4 w-4 text-leaf-700" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
