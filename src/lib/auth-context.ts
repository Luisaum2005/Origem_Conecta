import { createContext, useContext } from "react";

export type ProfileType = "comprador" | "produtor" | "organizacao" | "admin";
export type ProfileRole = "comprador" | "produtor" | "gestor_organizacao" | "admin";

export type AuthProfile = {
  id: string;
  userId: string;
  tipo: ProfileType;
  nome: string;
  email: string;
  telefone?: string;
  roles: ProfileRole[];
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
  organization?: {
    type: "cooperativa" | "associacao";
    legalName: string;
    tradeName: string;
    cnpj: string;
    stateRegistration?: string;
    phone: string;
    addressLine: string;
    addressNumber?: string;
    addressComplement?: string;
    neighborhood?: string;
    postalCode: string;
    responsibleName: string;
    responsibleRole: string;
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
  if (tipo === "organizacao") return "/organizations";
  if (tipo === "produtor") return "/profile/producer";
  if (tipo === "admin") return "/admin";
  return "/portfolio";
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
