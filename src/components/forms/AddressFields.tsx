import { Field } from "@/components/auth/AuthShell";

export function AddressFields() {
  return (
    <fieldset className="space-y-5 rounded-2xl border border-border bg-white p-5">
      <legend className="px-2 text-sm font-semibold text-brand-900">Endereco</legend>
      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        <Field name="cep" label="CEP" placeholder="00000-000" required />
        <Field name="logradouro" label="Logradouro" placeholder="Rua, avenida..." required />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field name="numero" label="Numero" placeholder="123" required />
        <Field name="complemento" label="Complemento" placeholder="Sala / bloco" />
        <Field name="bairro" label="Bairro" placeholder="Centro" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field name="municipio" label="Municipio" placeholder="Sao Paulo" required />
        <Field name="uf" label="UF" placeholder="SP" required />
      </div>
    </fieldset>
  );
}
