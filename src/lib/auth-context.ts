import { createContext, useContext } from "react";

export type ProfileType = "comprador" | "produtor" | "admin";

export type AuthProfile = {
  id: string;
  userId: string;
  tipo: ProfileType;
  nome: string;
  email: string;
  telefone?: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  tipo: ProfileType;
  email: string;
  password: string;
  nome: string;
  telefone?: string;
  adminInviteCode?: string;
  cidade?: string;
  estado?: string;
  buyer?: {
    nomeEmpresa: string;
    tipoEmpresa: string;
    cnpj: string;
  };
  producer?: {
    nomePropriedade: string;
    responsavel: string;
    cnpj: string;
    produtos: string[];
  };
};

export type AuthContextValue = {
  profile: AuthProfile | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  signIn: (input: SignInInput) => Promise<AuthProfile>;
  signUp: (input: SignUpInput) => Promise<AuthProfile>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function getProfileHome(tipo: ProfileType) {
  if (tipo === "produtor") return "/profile/producer";
  if (tipo === "admin") return "/admin";
  return "/portfolio";
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
