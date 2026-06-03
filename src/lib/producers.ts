import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type RegisteredProducer = {
  id: string;
  propertyName: string;
  responsibleName: string;
  cnpj: string;
  location: string;
  products: string[];
  active: boolean;
};

type RemoteProducer = {
  id: string;
  nome_propriedade: string | null;
  responsavel: string | null;
  cnpj: string | null;
  localizacao: string | null;
  categorias_atendidas: string[] | null;
  ativo: boolean | null;
};

function mapProducer(row: RemoteProducer): RegisteredProducer {
  return {
    id: row.id,
    propertyName: row.nome_propriedade || "Propriedade sem nome",
    responsibleName: row.responsavel || "Responsável não informado",
    cnpj: row.cnpj || "",
    location: row.localizacao || "",
    products: row.categorias_atendidas ?? [],
    active: row.ativo !== false,
  };
}

async function loadProducers() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("producers")
    .select("id,nome_propriedade,responsavel,cnpj,localizacao,categorias_atendidas,ativo")
    .order("nome_propriedade", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapProducer(row as RemoteProducer));
}

export function useRegisteredProducers() {
  const { profile, isSupabaseConfigured } = useAuth();
  const [producers, setProducers] = useState<RegisteredProducer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || profile?.tipo !== "admin") {
      setProducers([]);
      return;
    }

    let active = true;
    setLoading(true);

    loadProducers()
      .then((nextProducers) => {
        if (active) setProducers(nextProducers);
      })
      .catch((error) => {
        console.warn("Não foi possível carregar produtores cadastrados.", error);
        if (active) setProducers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSupabaseConfigured, profile?.tipo]);

  return { producers, loading };
}
