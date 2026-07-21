export type ErrorContext = Record<string, string | number | boolean | null | undefined>;

export function reportAppError(error: unknown, context: ErrorContext = {}) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const report = {
    message: normalized.message,
    stack: normalized.stack,
    context,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    occurredAt: new Date().toISOString(),
  };

  console.error("[Origem Conecta]", report);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("origem-conecta:error", { detail: report }));
  }

  const endpoint = import.meta.env.VITE_ERROR_REPORT_URL as string | undefined;
  if (endpoint && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    navigator.sendBeacon(endpoint, JSON.stringify(report));
  }
}

export function installGlobalErrorMonitoring() {
  if (typeof window === "undefined") return () => undefined;
  const onError = (event: ErrorEvent) =>
    reportAppError(event.error ?? event.message, { source: "window.error" });
  const onRejection = (event: PromiseRejectionEvent) =>
    reportAppError(event.reason, { source: "unhandledrejection" });
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
