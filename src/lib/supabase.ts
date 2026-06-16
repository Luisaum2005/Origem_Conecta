import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

type SupabaseLikeError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

export function toReadableSupabaseError(error: SupabaseLikeError | null | undefined) {
  if (!error) return "Erro desconhecido do Supabase.";
  return [error.message, error.details, error.hint, error.code ? `Codigo: ${error.code}` : ""]
    .filter(Boolean)
    .join(" ");
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
