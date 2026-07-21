export type CepAddress = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  source: "ViaCEP" | "BrasilAPI";
};

type ViaCepResponse = {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

type BrasilApiResponse = {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

export class CepLookupError extends Error {
  constructor(
    public readonly reason: "invalid" | "not_found" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "CepLookupError";
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return (await response.json()) as T;
}

async function lookupViaCep(cep: string, signal?: AbortSignal): Promise<CepAddress> {
  const data = await fetchJson<ViaCepResponse>(`https://viacep.com.br/ws/${cep}/json/`, signal);
  if (data.erro === true || data.erro === "true" || !data.localidade || !data.uf) {
    throw new CepLookupError("not_found", "CEP não encontrado.");
  }
  return {
    street: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade,
    state: data.uf,
    source: "ViaCEP",
  };
}

async function lookupBrasilApi(cep: string, signal?: AbortSignal): Promise<CepAddress> {
  const data = await fetchJson<BrasilApiResponse>(
    `https://brasilapi.com.br/api/cep/v2/${cep}`,
    signal,
  );
  if (!data.city || !data.state) {
    throw new CepLookupError("not_found", "CEP não encontrado.");
  }
  return {
    street: data.street ?? "",
    neighborhood: data.neighborhood ?? "",
    city: data.city,
    state: data.state,
    source: "BrasilAPI",
  };
}

function isNotFound(error: unknown) {
  return (
    (error instanceof CepLookupError && error.reason === "not_found") ||
    (typeof error === "object" && error !== null && "status" in error && error.status === 404)
  );
}

export async function lookupAddressByCep(cep: string, signal?: AbortSignal): Promise<CepAddress> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) {
    throw new CepLookupError("invalid", "Informe um CEP com 8 números.");
  }

  let viaCepError: unknown;
  try {
    return await lookupViaCep(digits, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    viaCepError = error;
  }

  try {
    return await lookupBrasilApi(digits, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (isNotFound(viaCepError) || isNotFound(error)) {
      throw new CepLookupError("not_found", "CEP não encontrado.");
    }
    throw new CepLookupError("unavailable", "Os serviços de CEP estão indisponíveis.");
  }
}
