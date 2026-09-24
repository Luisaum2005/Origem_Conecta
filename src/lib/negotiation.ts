import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import type { ProducerOption, Product } from "@/lib/catalog";
import { getOrCreateConversation } from "@/lib/chats";
import { getBuyerId } from "@/lib/orders";

/** Abre (ou cria) a conversa do comprador com o produtor sobre um anúncio. */
export function useStartNegotiation() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [negotiating, setNegotiating] = useState(false);

  const startNegotiation = async (product: Product, producer: ProducerOption) => {
    if (!profile) {
      toast.error("Você precisa estar logado para negociar.");
      void navigate({ to: "/login" });
      return;
    }
    if (profile.tipo !== "comprador") {
      toast.error("Apenas compradores podem negociar produtos do portfólio.");
      return;
    }

    setNegotiating(true);
    try {
      const buyerId = await getBuyerId(profile.id);
      if (!buyerId) {
        throw new Error("Cadastro de comprador não encontrado.");
      }

      const conv = await getOrCreateConversation({
        portfolioProductId: product.id,
        buyerId,
        producerId: producer.id,
        systemMessageOnCreate: `Você iniciou uma negociação sobre o anúncio ${product.name}.`,
        senderId: profile.id,
      });

      void navigate({
        to: "/chat",
        search: { id: conv.id },
      });
    } catch (err) {
      console.error("Erro ao iniciar negociação:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar negociação.");
    } finally {
      setNegotiating(false);
    }
  };

  return { negotiating, startNegotiation };
}
