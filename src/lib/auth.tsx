import { supabase } from "@/lib/supabase";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ProfileType = "comprador" | "produtor" | "admin";

export type AuthProfile = {
  id: string;
  userId: string;
  tipo: ProfileType;
  nome: string;
  email: string;
  telefone?: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type SignUpInput = {
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
  };
  producer?: {
    nomePropriedade: string;
    responsavel: string;
    produtos: string[];
  };
};

type AuthContextValue = {
  profile: AuthProfile | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  signIn: (input: SignInInput) => Promise<AuthProfile>;
  signUp: (input: SignUpInput) => Promise<AuthProfile>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const LOCAL_PROFILE_KEY = "origem-conecta-auth-profile";
const adminInviteCode = import.meta.env.VITE_ADMIN_INVITE_CODE as string | undefined;

function readLocalProfile() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LOCAL_PROFILE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthProfile;
  } catch {
    return null;
  }
}

function redirectPath(tipo: ProfileType) {
  if (tipo === "produtor") return "/profile/producer";
  if (tipo === "admin") return "/admin";
  return "/portfolio";
}

export function getProfileHome(tipo: ProfileType) {
  return redirectPath(tipo);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthProfile | null>(readLocalProfile);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    let active = true;

    async function loadProfile() {
      const { data: userData } = await client.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (active) setProfile(null);
        if (active) setLoading(false);
        return;
      }

      const { data } = await client
        .from("profiles")
        .select("id,user_id,tipo,nome,email,telefone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (active && data) {
        setProfile({
          id: data.id,
          userId: data.user_id,
          tipo: data.tipo,
          nome: data.nome,
          email: data.email,
          telefone: data.telefone ?? undefined,
        });
      }
      if (active) setLoading(false);
    }

    loadProfile();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading,
      isSupabaseConfigured: Boolean(supabase),
      signIn: async ({ email, password }) => {
        if (!supabase) {
          const tipo: ProfileType = email.toLowerCase().includes("produtor")
            ? "produtor"
            : email.toLowerCase().includes("admin")
              ? "admin"
              : "comprador";
          const localProfile: AuthProfile = {
            id: `local-${tipo}`,
            userId: `local-user-${tipo}`,
            tipo,
            nome:
              tipo === "produtor"
                ? "Ramy Pitayas"
                : tipo === "admin"
                  ? "Admin Origem"
                  : "Cozinha Atelier",
            email,
          };
          window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(localProfile));
          setProfile(localProfile);
          return localProfile;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const userId = data.user.id;
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id,user_id,tipo,nome,email,telefone")
          .eq("user_id", userId)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profileData) throw new Error("Perfil não encontrado para este usuário.");
        const nextProfile: AuthProfile = {
          id: profileData.id,
          userId: profileData.user_id,
          tipo: profileData.tipo,
          nome: profileData.nome,
          email: profileData.email,
          telefone: profileData.telefone ?? undefined,
        };
        setProfile(nextProfile);
        return nextProfile;
      },
      signUp: async (input) => {
        if (
          input.tipo === "admin" &&
          (!adminInviteCode || input.adminInviteCode !== adminInviteCode)
        ) {
          throw new Error("Codigo de convite administrativo invalido.");
        }

        if (!supabase) {
          const localProfile: AuthProfile = {
            id: `local-${input.tipo}`,
            userId: `local-user-${input.tipo}`,
            tipo: input.tipo,
            nome: input.nome,
            email: input.email,
            telefone: input.telefone,
          };
          window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(localProfile));
          setProfile(localProfile);
          return localProfile;
        }

        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
        });
        if (error) throw error;
        if (!data.user) throw new Error("Usuário não foi criado.");

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: data.user.id,
            tipo: input.tipo,
            nome: input.nome,
            telefone: input.telefone,
            email: input.email,
            cidade: input.cidade,
            estado: input.estado,
          })
          .select("id,user_id,tipo,nome,email,telefone")
          .single();
        if (profileError) throw profileError;

        if (input.tipo === "comprador" && input.buyer) {
          const { error: buyerError } = await supabase.from("buyers").insert({
            profile_id: profileData.id,
            nome_empresa: input.buyer.nomeEmpresa,
            tipo_empresa: input.buyer.tipoEmpresa,
          });
          if (buyerError) throw buyerError;
        }

        if (input.tipo === "produtor" && input.producer) {
          const { error: producerError } = await supabase.from("producers").insert({
            profile_id: profileData.id,
            nome_propriedade: input.producer.nomePropriedade,
            responsavel: input.producer.responsavel,
            categorias_atendidas: input.producer.produtos,
          });
          if (producerError) throw producerError;
        }

        const nextProfile: AuthProfile = {
          id: profileData.id,
          userId: profileData.user_id,
          tipo: profileData.tipo,
          nome: profileData.nome,
          email: profileData.email,
          telefone: profileData.telefone ?? undefined,
        };
        setProfile(nextProfile);
        return nextProfile;
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        window.localStorage.removeItem(LOCAL_PROFILE_KEY);
        setProfile(null);
      },
    }),
    [loading, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
