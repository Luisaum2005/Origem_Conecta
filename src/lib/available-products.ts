import { useMemo } from "react";
import { CATALOG, type Product } from "@/lib/catalog";
import { useProducerStock } from "@/lib/producer-stock";
import { supabase } from "@/lib/supabase";

const DEFAULT_PRODUCER = {
  id: "produtor",
  name: "Produtor",
  property: "Produtor",
  origin: "Localização não informada",
  onTimeRate: 97,
  reliabilityScore: 4.9,
  eta: "próximo ciclo",
};

function catalogMatch(productName: string) {
  return CATALOG.find((product) => product.name.toLowerCase() === productName.toLowerCase());
}

function inferCategory(productName: string) {
  return catalogMatch(productName)?.category ?? "Disponibilidade do produtor";
}

function inferEmoji(productName: string) {
  return catalogMatch(productName)?.emoji ?? "📦";
}

export function useAvailableProducts() {
  const [stock] = useProducerStock();

  return useMemo<Product[]>(() => {
    let localProducer: {
      nome_propriedade?: string;
      responsavel?: string;
      localizacao?: string;
    } | null = null;
    if (!supabase && typeof window !== "undefined") {
      try {
        // In local mock mode, we fallback to the default local producer profile details
        const detailsJson = window.localStorage.getItem(
          "origem-conecta-local-producer-local-produtor",
        );
        if (detailsJson) {
          localProducer = JSON.parse(detailsJson);
        }
      } catch (e) {
        console.error(e);
      }
    }

    return stock
      .filter((item) => item.status === "ativo" && Number(item.quantity) > 0)
      .map((item) => {
        const match = catalogMatch(item.product);

        const producerName =
          item.producerResponsible ??
          item.producerName ??
          localProducer?.responsavel ??
          DEFAULT_PRODUCER.name;
        const propertyName =
          item.producerName ?? localProducer?.nome_propriedade ?? DEFAULT_PRODUCER.property;
        const location =
          item.producerLocation ?? localProducer?.localizacao ?? DEFAULT_PRODUCER.origin;

        return {
          id: item.id,
          name: item.product,
          category: inferCategory(item.product),
          unit: item.unit,
          description:
            item.notes || match?.description || "Produto disponível no estoque do produtor.",
          emoji: inferEmoji(item.product),
          imageUrl: item.imageUrl,
          videoUrl: item.videoUrl,
          risk: "baixo",
          substitutes: [],
          producers: [
            {
              ...DEFAULT_PRODUCER,
              id: item.producerId ?? DEFAULT_PRODUCER.id,
              name: producerName,
              property: propertyName,
              origin: location,
              price: Number(item.price || 0),
              stock: Number(item.quantity || 0),
              sellerOrganizationId: item.sellerOrganizationId,
              sellerOrganizationName: item.sellerOrganizationName,
              sellerOrganizationCnpj: item.sellerOrganizationCnpj,
              commercializationMode: item.commercializationMode,
              commercialVerificationStatus: item.commercialVerificationStatus,
            },
          ],
        };
      });
  }, [stock]);
}
