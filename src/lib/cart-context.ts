import { createContext, useContext } from "react";

export type CartState = Record<string, number>;
export type ProducerChoiceState = Record<string, string>;
export type UnitState = Record<string, string>;
export type CartContextValue = {
  cart: CartState;
  producerChoices: ProducerChoiceState;
  selectedUnits: UnitState;
  setQty: (id: string, qty: number) => void;
  replaceCart: (
    cart: CartState,
    producerChoices?: ProducerChoiceState,
    selectedUnits?: UnitState,
  ) => void;
  setProducerChoice: (productId: string, producerId: string) => void;
  setUnit: (productId: string, unit: string) => void;
  totalItems: number;
  clear: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("CartProvider missing");
  return context;
}
