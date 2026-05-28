import { Field } from "@/components/auth/AuthShell";

export function AddressFields() {
  return (
    <fieldset className="space-y-5 rounded-2xl border border-border bg-white p-5">
      <legend className="px-2 text-sm font-semibold text-brand-900">Endereço</legend>
      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        <Field label="CEP" placeholder="00000-000" required />
        <Field label="Logradouro" placeholder="Rua, avenida…" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Número" placeholder="123" required />
        <Field label="Complemento" placeholder="Sala / bloco" />
        <Field label="Bairro" placeholder="Centro" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field label="Município" placeholder="São Paulo" required />
        <Field label="UF" placeholder="SP" required />
      </div>
    </fieldset>
  );
}
