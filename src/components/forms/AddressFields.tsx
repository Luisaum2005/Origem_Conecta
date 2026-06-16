import { Field } from "@/components/auth/AuthShell";
import { useState, type FocusEvent } from "react";

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

function setFormValue(form: HTMLFormElement | null, name: string, value?: string) {
  if (!form || !value) return;
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement) {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export function AddressFields() {
  const [cepStatus, setCepStatus] = useState("");

  const handleCepBlur = async (event: FocusEvent<HTMLInputElement>) => {
    const digits = event.currentTarget.value.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus("");
      return;
    }

    setCepStatus("Buscando endereço...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error("CEP não encontrado");
      const data = (await response.json()) as ViaCepResponse;
      if (data.erro) throw new Error("CEP não encontrado");

      const form = event.currentTarget.form;
      setFormValue(form, "logradouro", data.logradouro);
      setFormValue(form, "bairro", data.bairro);
      setFormValue(form, "municipio", data.localidade);
      setFormValue(form, "uf", data.uf);
      setCepStatus("Endereço preenchido pelo CEP.");
    } catch {
      setCepStatus("Não foi possível buscar esse CEP. Preencha o endereço manualmente.");
    }
  };

  return (
    <fieldset className="space-y-5 rounded-2xl border border-border bg-white p-5">
      <legend className="px-2 text-sm font-semibold text-brand-900">Endereço</legend>
      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        <Field
          name="cep"
          label="CEP"
          placeholder="00000-000"
          inputMode="numeric"
          onBlur={handleCepBlur}
          helper={cepStatus}
          required
        />
        <Field name="logradouro" label="Logradouro" placeholder="Rua, avenida..." required />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field name="numero" label="Número" placeholder="123" required />
        <Field name="complemento" label="Complemento" placeholder="Sala, bloco..." />
        <Field name="bairro" label="Bairro" placeholder="Bairro" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field name="municipio" label="Município" placeholder="Cidade" required />
        <Field name="uf" label="UF" placeholder="SP" maxLength={2} required />
      </div>
    </fieldset>
  );
}
