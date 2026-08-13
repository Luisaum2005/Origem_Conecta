export type BackendMode = "supabase" | "demo" | "unavailable";

type BackendModeInput = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  demoModeRequested?: string;
  isDevelopment: boolean;
};

export function resolveBackendMode({
  supabaseUrl,
  supabaseAnonKey,
  demoModeRequested,
  isDevelopment,
}: BackendModeInput): BackendMode {
  if (supabaseUrl?.trim() && supabaseAnonKey?.trim()) return "supabase";
  if (isDevelopment && demoModeRequested?.trim().toLowerCase() === "true") return "demo";
  return "unavailable";
}
