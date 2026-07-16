import { supabase, throwSupabaseError } from "@/lib/supabase";
import {
  AuthContext,
  type AuthContextValue,
  type AuthProfile,
  type ProfileType,
  type SignInInput,
  type SignUpInput,
} from "@/lib/auth-context";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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

    async function loadProfile(userId?: string) {
      if (!userId) {
        if (active) setProfile(null);
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await client
        .from("profiles")
        .select("id,user_id,tipo,nome,email,telefone")
        .eq("user_id", userId)
        .maybeSingle();

      if (active && data) {
        const restoredProfile: AuthProfile = {
          id: data.id,
          userId: data.user_id,
          tipo: data.tipo,
          nome: data.nome,
          email: data.email,
          telefone: data.telefone ?? undefined,
        };
        setProfile(restoredProfile);
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(restoredProfile));
      } else if (active && !error) {
        setProfile(null);
      }
      if (active) setLoading(false);
    }

    void client.auth.getSession().then(({ data }) => {
      void loadProfile(data.session?.user.id);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      // Run outside the auth callback to avoid competing with Supabase's session lock.
      window.setTimeout(() => void loadProfile(session?.user.id), 0);
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
            nome: tipo === "produtor" ? "Produtor" : tipo === "admin" ? "Admin" : "Comprador",
            email,
          };
          window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(localProfile));
          if (tipo === "produtor") {
            window.localStorage.setItem(
              `origem-conecta-local-producer-${localProfile.id}`,
              JSON.stringify({
                nome_propriedade: "Sítio das Laranjas",
                responsavel: "Produtor Teste",
                localizacao: "Atibaia, SP",
              }),
            );
          }
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
        throwSupabaseError(profileError);
        if (!profileData) throw new Error("Perfil não encontrado para este usuário.");
        const nextProfile: AuthProfile = {
          id: profileData.id,
          userId: profileData.user_id,
          tipo: profileData.tipo,
          nome: profileData.nome,
          email: profileData.email,
          telefone: profileData.telefone ?? undefined,
        };
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
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
          if (input.tipo === "produtor" && input.producer) {
            const location = [input.cidade, input.estado].filter(Boolean).join(", ");
            window.localStorage.setItem(
              `origem-conecta-local-producer-${localProfile.id}`,
              JSON.stringify({
                nome_propriedade: input.producer.nomePropriedade,
                responsavel: input.producer.responsavel,
                localizacao: location || "Localização não informada",
              }),
            );
          }
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
        throwSupabaseError(profileError);
        if (!profileData) throw new Error("Falha ao criar o perfil.");

        if (input.tipo === "comprador" && input.buyer) {
          const { error: buyerError } = await supabase.from("buyers").insert({
            profile_id: profileData.id,
            nome_empresa: input.buyer.nomeEmpresa,
            tipo_empresa: input.buyer.tipoEmpresa,
            cnpj: input.buyer.cnpj,
          });
          throwSupabaseError(buyerError);
        }

        if (input.tipo === "produtor" && input.producer) {
          const location = [input.cidade, input.estado].filter(Boolean).join(", ");
          const { error: producerError } = await supabase.from("producers").insert({
            profile_id: profileData.id,
            nome_propriedade: input.producer.nomePropriedade,
            responsavel: input.producer.responsavel,
            cnpj: input.producer.cnpj,
            localizacao: location || null,
            categorias_atendidas: input.producer.produtos,
          });
          throwSupabaseError(producerError);
        }

        const nextProfile: AuthProfile = {
          id: profileData.id,
          userId: profileData.user_id,
          tipo: profileData.tipo,
          nome: profileData.nome,
          email: profileData.email,
          telefone: profileData.telefone ?? undefined,
        };
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
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
