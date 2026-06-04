import { Field } from "@/components/auth/AuthShell";

export function AddressFields() {
  return (
    <fieldset className="space-y-5 rounded-2xl border border-border bg-white p-5">
      <legend className="px-2 text-sm font-semibold text-brand-900">Endereco</legend>
      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        <Field name="cep" label="CEP" placeholder="Digite o CEP" required />
        <Field
          name="logradouro"
          label="Logradouro"
          placeholder="Digite a rua ou avenida"
          required
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field name="numero" label="Numero" placeholder="Digite o numero" required />
        <Field name="complemento" label="Complemento" placeholder="Digite o complemento" />
        <Field name="bairro" label="Bairro" placeholder="Digite o bairro" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field name="municipio" label="Municipio" placeholder="Digite o municipio" required />
        <Field name="uf" label="UF" placeholder="Digite a UF" required />
      </div>
    </fieldset>
  );
}
