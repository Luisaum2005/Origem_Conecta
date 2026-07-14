import { createContext, useContext, useState, type ReactNode } from "react";

type CartState = Record<string, number>;
type ProducerChoiceState = Record<string, string>;
type UnitState = Record<string, string>;
type Ctx = {
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

const CartCtx = createContext<Ctx | null>(null);

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
    <CartCtx.Provider
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
    </CartCtx.Provider>
  );
}

export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error("CartProvider missing");
  return c;
};
