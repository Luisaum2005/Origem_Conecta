import { isDemoMode, supabase, throwSupabaseError } from "@/lib/supabase";
import {
  AuthContext,
  shouldRestoreProfileForAuthEvent,
  type AuthContextValue,
  type AuthProfile,
  type ProfileRole,
  type ProfileType,
  type SignInInput,
} from "@/lib/auth-context";
import { buildSignupPayload } from "@/lib/signup-payload";
import { reportAppError } from "@/lib/error-monitor";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
const LOCAL_PROFILE_KEY = "origem-conecta-auth-profile";

function defaultRole(tipo: ProfileType): ProfileRole {
  return tipo === "organizacao" ? "gestor_organizacao" : tipo;
}

async function getProfileRoles(profileId: string, tipo: ProfileType) {
  if (!supabase) return [defaultRole(tipo)];
  const { data } = await supabase.from("profile_roles").select("role").eq("profile_id", profileId);
  return (data?.map((item) => item.role as ProfileRole) ?? [defaultRole(tipo)]) as ProfileRole[];
}

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
  // Keep the server and the browser's first render identical. Browser storage is
  // restored only after hydration, including in the explicit demo mode.
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const restoredUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setProfile(readLocalProfile());
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    let active = true;
    let restoreVersion = 0;

    async function loadProfile(userId?: string) {
      const currentVersion = ++restoreVersion;

      if (!userId) {
        restoredUserIdRef.current = null;
        if (active && currentVersion === restoreVersion) setProfile(null);
        window.localStorage.removeItem(LOCAL_PROFILE_KEY);
        if (active && currentVersion === restoreVersion) setLoading(false);
        return;
      }

      try {
        const { data, error } = await client
          .from("profiles")
          .select("id,user_id,tipo,nome,email,telefone")
          .eq("user_id", userId)
          .maybeSingle();
        throwSupabaseError(error);

        if (!active || currentVersion !== restoreVersion) return;
        if (!data) {
          restoredUserIdRef.current = null;
          setProfile(null);
          window.localStorage.removeItem(LOCAL_PROFILE_KEY);
          return;
        }

        const restoredProfile: AuthProfile = {
          id: data.id,
          userId: data.user_id,
          tipo: data.tipo,
          nome: data.nome,
          email: data.email,
          telefone: data.telefone ?? undefined,
          roles: await getProfileRoles(data.id, data.tipo as ProfileType),
        };
        if (!active || currentVersion !== restoreVersion) return;
        restoredUserIdRef.current = userId;
        setProfile(restoredProfile);
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(restoredProfile));
      } catch (error) {
        if (!active || currentVersion !== restoreVersion) return;
        reportAppError(error, { source: "auth-session-restore" });
        restoredUserIdRef.current = null;
        setProfile(null);
        window.localStorage.removeItem(LOCAL_PROFILE_KEY);
      } finally {
        if (active && currentVersion === restoreVersion) setLoading(false);
      }
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!shouldRestoreProfileForAuthEvent(event, restoredUserIdRef.current, session?.user.id)) {
        return;
      }
      // Run outside the auth callback to avoid competing with Supabase's session lock.
      setLoading(true);
      window.setTimeout(() => void loadProfile(session?.user.id), 0);
    });
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        throwSupabaseError(error);
        return loadProfile(data.session?.user.id);
      })
      .catch((error) => {
        if (!active) return;
        reportAppError(error, { source: "auth-session-read" });
        setProfile(null);
        setLoading(false);
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
      isDemoMode,
      signIn: async ({ email, password }) => {
        if (!supabase) {
          if (!isDemoMode) {
            throw new Error("O serviço de autenticação está temporariamente indisponível.");
          }
          const tipo: ProfileType = email.toLowerCase().includes("produtor")
            ? "produtor"
            : "comprador";
          const localProfile: AuthProfile = {
            id: `local-${tipo}`,
            userId: `local-user-${tipo}`,
            tipo,
            nome: tipo === "produtor" ? "Produtor" : "Comprador",
            email,
            roles: [defaultRole(tipo)],
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
        throwSupabaseError(error);
        if (!data.user) throw new Error("Não foi possível identificar o usuário.");
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
          roles: await getProfileRoles(profileData.id, profileData.tipo as ProfileType),
        };
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
        setProfile(nextProfile);
        return nextProfile;
      },
      signUp: async (input) => {
        if (input.tipo === "admin") {
          throw new Error("O cadastro público de administrador não está disponível.");
        }

        if (!supabase) {
          if (!isDemoMode) {
            throw new Error("O serviço de autenticação está temporariamente indisponível.");
          }
          const localProfile: AuthProfile = {
            id: `local-${input.tipo}`,
            userId: `local-user-${input.tipo}`,
            tipo: input.tipo,
            nome: input.nome,
            email: input.email,
            telefone: input.telefone,
            roles:
              input.organization && input.tipo === "produtor"
                ? ["produtor", "gestor_organizacao"]
                : [defaultRole(input.tipo)],
          };
          window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(localProfile));
          if (input.tipo === "produtor" && input.producer) {
            const location = [input.cidade, input.estado].filter(Boolean).join(", ");
            window.localStorage.setItem(
              `origem-conecta-local-producer-${localProfile.id}`,
              JSON.stringify({
                nome_propriedade: input.producer.nomePropriedade,
                responsavel: input.producer.responsavel,
                cnpj: input.producer.cnpj,
                commercialization_mode: input.producer.commercializationMode,
                caepf: input.producer.caepf,
                state_registration: input.producer.stateRegistration,
                localizacao: location || "Localização não informada",
                postal_code: input.producer.postalCode,
                address_line: input.producer.addressLine,
                address_number: input.producer.addressNumber,
                address_complement: input.producer.addressComplement,
                neighborhood: input.producer.neighborhood,
                cidade: input.cidade,
                estado: input.estado,
              }),
            );
          }
          if (input.tipo === "comprador" && input.buyer) {
            window.localStorage.setItem(
              "origem-conecta-buyer-profile",
              JSON.stringify({
                companyName: input.buyer.nomeEmpresa,
                businessType: input.buyer.tipoEmpresa,
                cnpj: input.buyer.cnpj,
                responsibleName: input.nome,
                phone: input.telefone ?? "",
                postalCode: input.buyer.postalCode,
                addressLine: input.buyer.addressLine,
                addressNumber: input.buyer.addressNumber ?? "",
                addressComplement: input.buyer.addressComplement ?? "",
                neighborhood: input.buyer.neighborhood,
                city: input.cidade ?? "",
                state: input.estado ?? "",
                currentSupplier: "",
                monthlySpend: "",
              }),
            );
          }
          setProfile(localProfile);
          return { profile: localProfile, requiresEmailConfirmation: false };
        }

        const signupPayload = buildSignupPayload(input);
        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: { data: { signup_payload: signupPayload } },
        });
        throwSupabaseError(error);
        if (!data.user) throw new Error("Usuário não foi criado.");

        if (!data.session) {
          setProfile(null);
          return { profile: null, requiresEmailConfirmation: true };
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id,user_id,tipo,nome,email,telefone")
          .eq("user_id", data.user.id)
          .single();
        throwSupabaseError(profileError);
        if (!profileData) throw new Error("Falha ao concluir o cadastro.");

        const nextProfile: AuthProfile = {
          id: profileData.id,
          userId: profileData.user_id,
          tipo: profileData.tipo,
          nome: profileData.nome,
          email: profileData.email,
          telefone: profileData.telefone ?? undefined,
          roles:
            input.organization && input.tipo === "produtor"
              ? ["produtor", "gestor_organizacao"]
              : [defaultRole(input.tipo)],
        };
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
        setProfile(nextProfile);
        return { profile: nextProfile, requiresEmailConfirmation: false };
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
