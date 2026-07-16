import {
  CartContext,
  type CartState,
  type ProducerChoiceState,
  type UnitState,
} from "@/lib/cart-context";
import { useState, type ReactNode } from "react";

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>({});
  const [producerChoices, setProducerChoices] = useState<ProducerChoiceState>({});
  const [selectedUnits, setSelectedUnits] = useState<UnitState>({});
  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) {
        delete next[id];
        setSelectedUnits((prev) => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      } else {
        next[id] = qty;
      }
      return next;
    });
  const setProducerChoice = (productId: string, producerId: string) =>
    setProducerChoices((choices) => ({ ...choices, [productId]: producerId }));
  const setUnit = (productId: string, unit: string) =>
    setSelectedUnits((prev) => ({ ...prev, [productId]: unit }));
  const replaceCart = (
    nextCart: CartState,
    nextProducerChoices: ProducerChoiceState = {},
    nextSelectedUnits: UnitState = {},
  ) => {
    setCart(nextCart);
    setProducerChoices(nextProducerChoices);
    setSelectedUnits(nextSelectedUnits);
  };
  const totalItems = Object.keys(cart).length;
  return (
    <CartContext.Provider
      value={{
        cart,
        producerChoices,
        selectedUnits,
        setQty,
        replaceCart,
        setProducerChoice,
        setUnit,
        totalItems,
        clear: () => {
          setCart({});
          setProducerChoices({});
          setSelectedUnits({});
        },
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
