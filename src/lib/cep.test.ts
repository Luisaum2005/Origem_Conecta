import { lookupAddressByCep } from "@/lib/cep";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("consulta de CEP", () => {
  it("usa o ViaCEP quando a primeira consulta funciona", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        logradouro: "Praça da Sé",
        bairro: "Sé",
        localidade: "São Paulo",
        uf: "SP",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupAddressByCep("01001-000")).resolves.toEqual({
      street: "Praça da Sé",
      neighborhood: "Sé",
      city: "São Paulo",
      state: "SP",
      source: "ViaCEP",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("usa a BrasilAPI quando o ViaCEP está indisponível", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        jsonResponse({
          street: "Praça da Sé",
          neighborhood: "Sé",
          city: "São Paulo",
          state: "SP",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const address = await lookupAddressByCep("01001000");
    expect(address.source).toBe("BrasilAPI");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejeita CEP incompleto sem consultar a rede", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupAddressByCep("123")).rejects.toMatchObject({
      reason: "invalid",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("identifica um CEP inexistente depois de consultar os dois serviços", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ erro: true }))
      .mockResolvedValueOnce(jsonResponse({}, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupAddressByCep("99999999")).rejects.toMatchObject({
      reason: "not_found",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
