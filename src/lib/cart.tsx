import { createContext, useContext, useState, type ReactNode } from "react";

type CartState = Record<string, number>;
type ProducerChoiceState = Record<string, string>;
type Ctx = {
  cart: CartState;
  producerChoices: ProducerChoiceState;
  setQty: (id: string, qty: number) => void;
  replaceCart: (cart: CartState, producerChoices?: ProducerChoiceState) => void;
  setProducerChoice: (productId: string, producerId: string) => void;
  totalItems: number;
  clear: () => void;
};

const CartCtx = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>({});
  const [producerChoices, setProducerChoices] = useState<ProducerChoiceState>({});
  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  const setProducerChoice = (productId: string, producerId: string) =>
    setProducerChoices((choices) => ({ ...choices, [productId]: producerId }));
  const replaceCart = (nextCart: CartState, nextProducerChoices: ProducerChoiceState = {}) => {
    setCart(nextCart);
    setProducerChoices(nextProducerChoices);
  };
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  return (
    <CartCtx.Provider
      value={{
        cart,
        producerChoices,
        setQty,
        replaceCart,
        setProducerChoice,
        totalItems,
        clear: () => {
          setCart({});
          setProducerChoices({});
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
