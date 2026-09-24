import { supabase } from "@/lib/supabase";

/**
 * Modo demonstração (sem Supabase): lê listas já no formato do app guardadas no navegador.
 * Retorna null quando há backend configurado, para o chamador seguir o fluxo normal.
 */
export function readDemoList<T>(key: string): T[] | null {
  if (supabase || typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(`origem-conecta-demo-${key}`) ?? "[]");
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}
