import { Field, FormError } from "@/components/auth/AuthShell";
import { AddressFields } from "@/components/forms/AddressFields";
import {
  updateOrganizationSettings,
  type Organization,
  type OrganizationSettings,
} from "@/lib/organizations";
import { BadgeCheck, Building2, Check, Clock3, Pencil, X } from "lucide-react";
import { useState, type FormEvent } from "react";

export function OrganizationSettingsForm({
  organization,
  onUpdated,
}: {
  organization: Organization;
  onUpdated: () => Promise<unknown> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const settings: OrganizationSettings = {
      tradeName: String(form.get("nomeFantasia") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("telefone") ?? ""),
      addressLine: String(form.get("logradouro") ?? ""),
      addressNumber: String(form.get("numero") ?? ""),
      addressComplement: String(form.get("complemento") ?? ""),
      neighborhood: String(form.get("bairro") ?? ""),
      city: String(form.get("municipio") ?? ""),
      state: String(form.get("uf") ?? ""),
      postalCode: String(form.get("cep") ?? ""),
      responsibleName: String(form.get("responsavel") ?? ""),
      responsibleRole: String(form.get("cargo") ?? ""),
    };
    try {
      await updateOrganizationSettings(organization.id, settings);
      await onUpdated();
      setSuccess("Dados da organização atualizados.");
      setEditing(false);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Não foi possível atualizar a organização.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-leaf-100">
            <Building2 className="h-5 w-5 text-leaf-700" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-brand-900">{organization.tradeName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{organization.legalName}</p>
          </div>
        </div>
        <VerificationBadge status={organization.verificationStatus} />
      </div>

      {!editing ? (
        <>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <Info
              label="Tipo"
              value={organization.type === "cooperativa" ? "Cooperativa" : "Associação"}
            />
            <Info label="CNPJ" value={formatCnpj(organization.cnpj)} />
            <Info label="E-mail institucional" value={organization.email} />
            <Info label="Telefone/WhatsApp" value={formatPhone(organization.phone)} />
            <Info
              label="Responsável"
              value={`${organization.responsibleName} · ${organization.responsibleRole}`}
            />
            <Info label="Endereço" value={formatAddress(organization)} />
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setError("");
                setSuccess("");
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-brand-900 hover:bg-secondary"
            >
              <Pencil className="h-4 w-4" /> Editar dados
            </button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Razão social, CNPJ e tipo são dados protegidos da identidade institucional.
            </p>
          </div>
          {success && (
            <p
              className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800"
              role="status"
            >
              <Check className="h-4 w-4" /> {success}
            </p>
          )}
        </>
      ) : (
        <form className="mt-6 space-y-6" onSubmit={submit} noValidate>
          <fieldset className="rounded-2xl border border-border p-5">
            <legend className="px-2 text-sm font-semibold text-brand-900">
              Contato institucional
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                name="nomeFantasia"
                label="Nome fantasia"
                defaultValue={organization.tradeName}
                required
              />
              <Field
                name="email"
                label="E-mail institucional"
                type="email"
                defaultValue={organization.email}
                required
              />
              <Field
                name="telefone"
                label="Telefone/WhatsApp"
                type="tel"
                defaultValue={formatPhone(organization.phone)}
                required
              />
            </div>
          </fieldset>
          <fieldset className="rounded-2xl border border-border p-5">
            <legend className="px-2 text-sm font-semibold text-brand-900">
              Responsável institucional
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                name="responsavel"
                label="Nome completo"
                defaultValue={organization.responsibleName}
                required
              />
              <Field
                name="cargo"
                label="Cargo"
                defaultValue={organization.responsibleRole}
                required
              />
            </div>
          </fieldset>
          <AddressFields
            defaults={{
              postalCode: formatPostalCode(organization.postalCode),
              addressLine: organization.addressLine,
              addressNumber: organization.addressNumber,
              addressComplement: organization.addressComplement,
              neighborhood: organization.neighborhood,
              city: organization.city,
              state: organization.state,
            }}
          />
          <FormError>{error}</FormError>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-5 font-semibold text-brand-900 hover:bg-secondary disabled:opacity-60"
            >
              <X className="h-5 w-5" /> Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-900 px-5 font-semibold text-white disabled:bg-gray-300"
            >
              <Check className="h-5 w-5" /> {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium text-brand-900">{value || "Não informado"}</dd>
    </div>
  );
}

function VerificationBadge({ status }: { status: Organization["verificationStatus"] }) {
  const verified = status === "verified";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${verified ? "bg-green-100 text-green-800" : status === "failed" ? "bg-red-100 text-red-800" : "bg-secondary text-brand-900"}`}
    >
      {verified ? <BadgeCheck className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
      {verified ? "Verificada" : status === "failed" ? "Verificação pendente" : "Não verificada"}
    </span>
  );
}

function formatCnpj(value: string) {
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11
    ? digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
    : digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
}

function formatPostalCode(value: string) {
  return value.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function formatAddress(organization: Organization) {
  return [
    [organization.addressLine, organization.addressNumber].filter(Boolean).join(", "),
    organization.neighborhood,
    `${organization.city}/${organization.state}`,
    formatPostalCode(organization.postalCode),
  ]
    .filter(Boolean)
    .join(" · ");
}
