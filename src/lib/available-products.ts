import { useMemo } from "react";
import { CATALOG, type Product } from "@/lib/catalog";
import { useProducerStock } from "@/lib/producer-stock";

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

  return useMemo<Product[]>(
    () =>
      stock
        .filter((item) => item.status === "ativo" && Number(item.quantity) > 0)
        .map((item) => {
          const match = catalogMatch(item.product);
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
                name: item.producerResponsible ?? item.producerName ?? DEFAULT_PRODUCER.name,
                property: item.producerName ?? DEFAULT_PRODUCER.property,
                origin: item.producerLocation ?? DEFAULT_PRODUCER.origin,
                price: Number(item.price || 0),
                stock: Number(item.quantity || 0),
              },
            ],
          };
        }),
    [stock],
  );
}
