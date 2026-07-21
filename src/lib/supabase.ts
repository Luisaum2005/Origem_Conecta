import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      })
    : null;

type SupabaseLikeError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

export function toReadableSupabaseError(error: SupabaseLikeError | null | undefined) {
  if (!error) return "Não foi possível concluir a operação. Tente novamente.";
  const message = (error.message ?? "").toLowerCase();
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("user already registered")) return "Já existe uma conta com este e-mail.";
  if (message.includes("duplicate key") || error.code === "23505")
    return "Este cadastro já existe. Confira os dados informados.";
  if (message.includes("row-level security") || error.code === "42501")
    return "Você não tem permissão para realizar esta ação.";
  if (message.includes("failed to fetch") || message.includes("network"))
    return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  if (message.includes("jwt") || message.includes("session"))
    return "Sua sessão expirou. Entre novamente para continuar.";
  return "Não foi possível concluir a operação. Revise os dados e tente novamente.";
}

export function throwSupabaseError(error: SupabaseLikeError | null | undefined) {
  if (error) throw new Error(toReadableSupabaseError(error));
}

export function assertSupabaseConfigured() {
  if (!supabase) {
    throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar o Supabase.");
  }
  return supabase;
}
