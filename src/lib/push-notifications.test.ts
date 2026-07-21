import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  assertSupabaseConfigured: () => ({ rpc: mocks.rpc }),
  throwSupabaseError: (error: unknown) => {
    if (error) throw error;
  },
}));

import { getPushState } from "@/lib/push-notifications";

function configureBrowser(permission: NotificationPermission, subscription: unknown) {
  const register = vi.fn().mockResolvedValue({
    pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { PushManager: function PushManager() {}, Notification: {} },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: { register }, userAgent: "Vitest" },
  });
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: { permission },
  });
  return register;
}

describe("estado e reconciliação do Web Push", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("informa bloqueio sem registrar o service worker", async () => {
    const register = configureBrowser("denied", null);
    await expect(getPushState("user-1")).resolves.toBe("denied");
    expect(register).not.toHaveBeenCalled();
  });

  it("informa que a permissão ainda não foi solicitada", async () => {
    configureBrowser("default", null);
    await expect(getPushState("user-1")).resolves.toBe("default");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reconcilia no Supabase uma inscrição existente no navegador", async () => {
    configureBrowser("granted", {
      endpoint: "https://push.example/subscription",
      toJSON: () => ({ keys: { p256dh: "public-key", auth: "auth-key" } }),
    });
    await expect(getPushState("user-1")).resolves.toBe("enabled");
    expect(mocks.rpc).toHaveBeenCalledWith("register_push_subscription", {
      p_endpoint: "https://push.example/subscription",
      p_p256dh: "public-key",
      p_auth: "auth-key",
      p_user_agent: "Vitest",
    });
  });

  it("não mostra como ativada quando a reconciliação falha", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("Falha no banco") });
    configureBrowser("granted", {
      endpoint: "https://push.example/subscription",
      toJSON: () => ({ keys: { p256dh: "public-key", auth: "auth-key" } }),
    });
    await expect(getPushState("user-1")).rejects.toThrow("Falha no banco");
  });
});
