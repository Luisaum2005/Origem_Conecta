import { toReadableSupabaseError } from "@/lib/supabase";
import { resolveBackendMode } from "@/lib/backend-mode";
import { describe, expect, it } from "vitest";

describe("mensagens compreensíveis do Supabase", () => {
  it("traduz credenciais inválidas", () => {
    expect(toReadableSupabaseError({ message: "Invalid login credentials" })).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("traduz conta duplicada", () => {
    expect(toReadableSupabaseError({ message: "User already registered" })).toBe(
      "Já existe uma conta com este e-mail.",
    );
  });

  it("traduz problemas de conexão", () => {
    expect(toReadableSupabaseError({ message: "Failed to fetch" })).toContain(
      "Verifique sua internet",
    );
  });

  it("não expõe detalhes técnicos inesperados", () => {
    expect(toReadableSupabaseError({ message: "internal postgres detail", code: "XX000" })).toBe(
      "Não foi possível concluir a operação. Revise os dados e tente novamente.",
    );
  });
});

describe("modo seguro do backend", () => {
  it("usa Supabase quando URL e chave estão presentes", () => {
    expect(
      resolveBackendMode({
        supabaseUrl: "https://project.supabase.co",
        supabaseAnonKey: "public-key",
        demoModeRequested: "false",
        isDevelopment: false,
      }),
    ).toBe("supabase");
  });

  it("permite demonstração somente quando solicitada em desenvolvimento", () => {
    expect(resolveBackendMode({ demoModeRequested: "true", isDevelopment: true })).toBe("demo");
    expect(resolveBackendMode({ demoModeRequested: "true", isDevelopment: false })).toBe(
      "unavailable",
    );
  });

  it("falha de forma segura quando a configuração está ausente", () => {
    expect(resolveBackendMode({ isDevelopment: true })).toBe("unavailable");
    expect(resolveBackendMode({ isDevelopment: false })).toBe("unavailable");
  });
});
