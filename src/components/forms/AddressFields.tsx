import { Field } from "@/components/auth/AuthShell";
import { CepLookupError, lookupAddressByCep } from "@/lib/cep";
import { Search } from "lucide-react";
import { useRef, useState, type FocusEvent } from "react";

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
  const [searching, setSearching] = useState(false);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  const searchCep = async (input: HTMLInputElement) => {
    const digits = input.value.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus(digits.length ? "Informe um CEP com 8 números." : "");
      return;
    }

    // Capture o formulário antes do await: o currentTarget do evento React não é persistente.
    const form = input.form;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setSearching(true);
    setCepStatus("Buscando endereço...");

    try {
      const address = await lookupAddressByCep(digits, controller.signal);
      setFormValue(form, "logradouro", address.street);
      setFormValue(form, "bairro", address.neighborhood);
      setFormValue(form, "municipio", address.city);
      setFormValue(form, "uf", address.state);
      setCepStatus(`Endereço preenchido por ${address.source}. Confira antes de continuar.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setCepStatus(
        error instanceof CepLookupError && error.reason === "not_found"
          ? "CEP não encontrado. Confira o número ou preencha o endereço manualmente."
          : "Não foi possível consultar o CEP agora. Preencha o endereço manualmente.",
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setSearching(false);
      }
    }
  };

  const handleCepBlur = (event: FocusEvent<HTMLInputElement>) => {
    void searchCep(event.currentTarget);
  };

  const handleSearchClick = () => {
    const input = fieldsetRef.current?.querySelector<HTMLInputElement>('input[name="cep"]');
    if (input) void searchCep(input);
  };

  return (
    <fieldset ref={fieldsetRef} className="space-y-5 rounded-2xl border border-border bg-white p-5">
      <legend className="px-2 text-sm font-semibold text-brand-900">Endereço</legend>
      <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
        <div>
          <Field
            name="cep"
            label="CEP"
            placeholder="00000-000"
            inputMode="numeric"
            onBlur={handleCepBlur}
            helper={cepStatus}
            aria-describedby="cep-status"
            required
          />
          <button
            type="button"
            onClick={handleSearchClick}
            disabled={searching}
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-secondary disabled:cursor-wait disabled:opacity-60"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {searching ? "Buscando..." : "Buscar CEP"}
          </button>
          <span id="cep-status" className="sr-only" aria-live="polite">
            {cepStatus}
          </span>
        </div>
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
