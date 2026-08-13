import { runDeduplicatedMutation } from "@/lib/mutation-guard";
import { describe, expect, it, vi } from "vitest";

describe("protecao contra mutacoes duplicadas", () => {
  it("reutiliza a mesma promessa durante uma operacao", async () => {
    const pending = new Map<string, Promise<unknown>>();
    let resolveOperation!: (value: string) => void;
    const operation = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveOperation = resolve;
        }),
    );

    const first = runDeduplicatedMutation(pending, "cancel:1", operation);
    const second = runDeduplicatedMutation(pending, "cancel:1", operation);

    expect(second).toBe(first);
    expect(operation).toHaveBeenCalledTimes(1);
    resolveOperation("ok");
    await expect(first).resolves.toBe("ok");
    expect(pending.size).toBe(0);
  });

  it("libera a chave quando a operacao falha", async () => {
    const pending = new Map<string, Promise<unknown>>();

    await expect(
      runDeduplicatedMutation(pending, "save", async () => {
        throw new Error("falha");
      }),
    ).rejects.toThrow("falha");
    expect(pending.size).toBe(0);
  });
});
