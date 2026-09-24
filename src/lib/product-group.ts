import { HORTIFRUTI } from "@/lib/hortifruti";

// Grupos curtos usados nos filtros e rótulos do app (Folhosas, Legumes, Frutas...).
const GROUP_LABEL: Record<string, string> = {
  "Folhas e verduras": "Folhosas",
  "Brócolis, couves e repolhos": "Folhosas",
  Legumes: "Legumes",
  "Raízes, tubérculos e bulbos": "Raízes",
  Frutas: "Frutas",
  "Ervas e Temperos": "Temperos",
  "Leite e Derivados": "Laticínios",
};

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const BY_NAME = new Map<string, string>();
for (const { group, items } of HORTIFRUTI) {
  const label = GROUP_LABEL[group];
  if (!label) continue;
  for (const item of items) BY_NAME.set(normalize(item), label);
}

export const PRODUCT_GROUPS = ["Folhosas", "Legumes", "Frutas", "Raízes", "Ovos"] as const;

export function productGroup(productName: string): string {
  const name = normalize(productName);
  const exact = BY_NAME.get(name);
  if (exact) return exact;
  if (/\bovos?\b/.test(name)) return "Ovos";
  if (/cheiro|salsa|cebolinha|coentro|alface|couve|rucula/.test(name)) return "Folhosas";
  for (const [item, label] of BY_NAME) {
    if (name.startsWith(item) || item.startsWith(name)) return label;
  }
  const first = name.split(/\s+/)[0];
  for (const [item, label] of BY_NAME) {
    if (item.split(/\s+/)[0] === first) return label;
  }
  return "Outros";
}
