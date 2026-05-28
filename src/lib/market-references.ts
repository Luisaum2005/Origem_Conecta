import { useEffect, useState } from "react";

export type MarketSource = "CEASA/CEAGESP" | "CONAB" | "CEPEA";
export type MarketTrend = "up" | "down" | "flat";

export type MarketReference = {
  id: string;
  productName: string;
  unit: string;
  ceasa: string;
  conab: string;
  cepea: string;
  trend: MarketTrend;
  variation: string;
  updatedAt: string;
};

export const MARKET_REFERENCES_STORAGE_KEY = "origem-conecta-market-references";

export const INITIAL_MARKET_REFERENCES: MarketReference[] = [
  {
    id: "pitaya-roxa",
    productName: "Pitaya Roxa",
    unit: "kg",
    ceasa: "18.90",
    conab: "18.20",
    cepea: "",
    trend: "up",
    variation: "+3,1%",
    updatedAt: "2026-05-28",
  },
  {
    id: "laranja-pera-rio",
    productName: "Laranja Pera Rio",
    unit: "kg",
    ceasa: "4.80",
    conab: "4.60",
    cepea: "",
    trend: "flat",
    variation: "0,4%",
    updatedAt: "2026-05-28",
  },
  {
    id: "limao-taiti",
    productName: "Limao Taiti",
    unit: "kg",
    ceasa: "5.90",
    conab: "6.10",
    cepea: "",
    trend: "down",
    variation: "-1,8%",
    updatedAt: "2026-05-28",
  },
  {
    id: "figo",
    productName: "Figo",
    unit: "kg",
    ceasa: "16.50",
    conab: "15.90",
    cepea: "",
    trend: "up",
    variation: "+2,6%",
    updatedAt: "2026-05-28",
  },
  {
    id: "cafe",
    productName: "Cafe",
    unit: "saca",
    ceasa: "",
    conab: "",
    cepea: "1280.25",
    trend: "up",
    variation: "+1,2%",
    updatedAt: "2026-05-28",
  },
];

function readMarketReferences() {
  if (typeof window === "undefined") return INITIAL_MARKET_REFERENCES;
  const stored = window.localStorage.getItem(MARKET_REFERENCES_STORAGE_KEY);
  if (!stored) return INITIAL_MARKET_REFERENCES;
  try {
    return JSON.parse(stored) as MarketReference[];
  } catch {
    return INITIAL_MARKET_REFERENCES;
  }
}

export function useMarketReferences() {
  const [references, setReferences] = useState<MarketReference[]>(readMarketReferences);

  useEffect(() => {
    window.localStorage.setItem(MARKET_REFERENCES_STORAGE_KEY, JSON.stringify(references));
  }, [references]);

  const saveReference = (reference: MarketReference) => {
    const next = {
      ...reference,
      id: reference.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setReferences((current) => {
      const exists = current.some((item) => item.id === next.id);
      return exists
        ? current.map((item) => (item.id === next.id ? next : item))
        : [next, ...current];
    });
  };

  const removeReference = (id: string) => {
    setReferences((current) => current.filter((item) => item.id !== id));
  };

  return { references, saveReference, removeReference };
}
