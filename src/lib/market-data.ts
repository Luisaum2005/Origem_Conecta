export type RiskLevel = "baixo" | "medio" | "alto";

export type ProducerOption = {
  id: string;
  name: string;
  property: string;
  origin: string;
  price: number;
  stock: number;
  onTimeRate: number;
  reliabilityScore: number;
  eta: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  emoji: string;
  imageUrl?: string;
  risk: RiskLevel;
  substitutes: string[];
  producers: ProducerOption[];
};

export type BuyerOrder = {
  id: string;
  date: string;
  status: string;
  total: number;
  estimatedSavings: number;
  onTime: boolean;
  producers: string[];
};

const producerBase = {
  sitio: {
    id: "sitio-maria",
    name: "Sítio Maria",
    property: "Sítio Maria",
    origin: "Ibiúna, SP",
    onTimeRate: 98,
    reliabilityScore: 4.8,
    eta: "terça de manhã",
  },
  vale: {
    id: "vale-verde",
    name: "Coop. Vale Verde",
    property: "Coop. Vale Verde",
    origin: "São Roque, SP",
    onTimeRate: 94,
    reliabilityScore: 4.6,
    eta: "quarta de manhã",
  },
  tanaka: {
    id: "familia-tanaka",
    name: "Família Tanaka",
    property: "Hortas Tanaka",
    origin: "Mogi das Cruzes, SP",
    onTimeRate: 96,
    reliabilityScore: 4.7,
    eta: "terça à tarde",
  },
  ramy: {
    id: "ramy-pitayas",
    name: "Ramy Pitayas",
    property: "Ramy Pitayas",
    origin: "Queiroz, SP",
    onTimeRate: 97,
    reliabilityScore: 4.9,
    eta: "terça de manhã",
  },
  cafe: {
    id: "fazenda-cafezal",
    name: "Fazenda Cafezal",
    property: "Fazenda Cafezal",
    origin: "Garça, SP",
    onTimeRate: 95,
    reliabilityScore: 4.6,
    eta: "quinta de manhã",
  },
  roca: {
    id: "cozinha-da-roca",
    name: "Cozinha da Roça",
    property: "Cozinha da Roça",
    origin: "Queiroz, SP",
    onTimeRate: 93,
    reliabilityScore: 4.5,
    eta: "quarta à tarde",
  },
};

type ProducerKey = keyof typeof producerBase;

function p(key: ProducerKey, price: number, stock: number): ProducerOption {
  return { ...producerBase[key], price, stock };
}

function item(
  id: string,
  name: string,
  category: string,
  unit: string,
  emoji: string,
  risk: RiskLevel,
  substitutes: string[],
  producers: ProducerOption[],
  description = "Produto local cadastrado para compra recorrente e abastecimento B2B.",
): Product {
  return { id, name, category, unit, description, emoji, risk, substitutes, producers };
}

export const CATALOG: Product[] = [
  item(
    "laranja-pera-rio",
    "Laranja Pera Rio",
    "Frutas cítricas",
    "kg",
    "🍊",
    "baixo",
    ["laranja-pera-natal", "ponca", "tangerina-cravo"],
    [p("sitio", 4.9, 240), p("vale", 5.1, 180)],
  ),
  item(
    "laranja-pera-natal",
    "Laranja Pera Natal",
    "Frutas cítricas",
    "kg",
    "🍊",
    "baixo",
    ["laranja-pera-rio", "ponca", "murcot"],
    [p("sitio", 5.2, 170), p("vale", 5.4, 130)],
  ),
  item(
    "limao-taiti",
    "Limão Taiti",
    "Frutas cítricas",
    "kg",
    "🟢",
    "medio",
    ["tangerina-cravo", "ponca"],
    [p("vale", 6.8, 44), p("sitio", 7.1, 35)],
  ),
  item(
    "ponca",
    "Poncã",
    "Frutas cítricas",
    "kg",
    "🍊",
    "baixo",
    ["tangerina-cravo", "murcot", "laranja-pera-rio"],
    [p("sitio", 6.2, 120), p("vale", 6.4, 82)],
  ),
  item(
    "tangerina-cravo",
    "Tangerina Cravo",
    "Frutas cítricas",
    "kg",
    "🍊",
    "medio",
    ["ponca", "murcot"],
    [p("vale", 6.6, 38)],
  ),
  item(
    "murcot",
    "Murcot",
    "Frutas cítricas",
    "kg",
    "🍊",
    "alto",
    ["ponca", "tangerina-cravo"],
    [p("sitio", 8.2, 18)],
  ),
  item(
    "pitaya-roxa",
    "Pitaya Roxa",
    "Frutas especiais",
    "kg",
    "🐉",
    "medio",
    ["pitaya-branca", "pitaya-amarela"],
    [p("ramy", 18.5, 42)],
  ),
  item(
    "pitaya-amarela",
    "Pitaya Amarela",
    "Frutas especiais",
    "kg",
    "💛",
    "alto",
    ["pitaya-branca", "pitaya-roxa"],
    [p("ramy", 24, 12)],
  ),
  item(
    "pitaya-branca",
    "Pitaya Branca",
    "Frutas especiais",
    "kg",
    "🤍",
    "baixo",
    ["pitaya-roxa", "pitaya-amarela"],
    [p("ramy", 16.8, 65)],
  ),
  item(
    "figo",
    "Figo",
    "Frutas",
    "kg",
    "🟣",
    "medio",
    ["goiaba", "mamao"],
    [p("vale", 14.5, 35), p("ramy", 15.2, 28)],
  ),
  item(
    "goiaba",
    "Goiaba",
    "Frutas",
    "kg",
    "🍈",
    "baixo",
    ["mamao", "figo"],
    [p("sitio", 7.5, 105)],
  ),
  item(
    "mamao",
    "Mamão",
    "Frutas",
    "kg",
    "🟠",
    "baixo",
    ["goiaba", "manga-maracuja"],
    [p("sitio", 6.9, 140), p("vale", 7.2, 96)],
  ),
  item(
    "amora-morango",
    "Amora e Morango",
    "Frutas",
    "caixa",
    "🍓",
    "alto",
    ["goiaba", "figo"],
    [p("tanaka", 22, 16)],
  ),
  item(
    "manga-maracuja",
    "Manga e Maracujá",
    "Frutas",
    "kg",
    "🥭",
    "medio",
    ["mamao", "goiaba"],
    [p("vale", 10.8, 46)],
  ),
  item(
    "doce-figo-ramy",
    "Doce Figo Ramy",
    "Doces e conservas",
    "pote",
    "🍯",
    "baixo",
    ["doce-abobora", "cocada-artesanal"],
    [p("ramy", 18, 70)],
  ),
  item(
    "geleia-laranja-pimenta",
    "Geleia laranja com pimenta",
    "Doces e conservas",
    "pote",
    "🌶️",
    "baixo",
    ["abacaxi-pimenta", "doce-figo-ramy"],
    [p("roca", 16, 58)],
  ),
  item(
    "abacaxi-pimenta",
    "Abacaxi com pimenta",
    "Doces e conservas",
    "pote",
    "🍍",
    "medio",
    ["geleia-laranja-pimenta", "doce-abobora"],
    [p("roca", 17.5, 26)],
  ),
  item(
    "picles-botao-pitaya",
    "Picles de Botão Floral de Pitaya",
    "Doces e conservas",
    "pote",
    "🥒",
    "alto",
    ["abacaxi-pimenta", "geleia-laranja-pimenta"],
    [p("ramy", 21, 10)],
  ),
  item(
    "fettuccine-pitaya",
    "Fettuccine de Pitaya",
    "Massas e panificados",
    "pacote",
    "🍝",
    "medio",
    ["pao-caseiro", "bolo-milho"],
    [p("ramy", 19, 32)],
  ),
  item(
    "pao-caseiro",
    "Pão caseiro",
    "Massas e panificados",
    "unidade",
    "🍞",
    "baixo",
    ["bolacha-nata", "bolo-milho"],
    [p("roca", 12, 80)],
  ),
  item(
    "bolacha-nata",
    "Bolacha de nata",
    "Massas e panificados",
    "pacote",
    "🍪",
    "baixo",
    ["pao-caseiro", "pacoca-artesanal"],
    [p("roca", 13.5, 65)],
  ),
  item(
    "pacoca-artesanal",
    "Paçoca artesanal",
    "Doces e conservas",
    "pacote",
    "🥜",
    "baixo",
    ["cocada-artesanal", "bolacha-nata"],
    [p("roca", 11, 90)],
  ),
  item(
    "cocada-artesanal",
    "Cocada artesanal",
    "Doces e conservas",
    "pacote",
    "🥥",
    "baixo",
    ["pacoca-artesanal", "doce-abobora"],
    [p("roca", 12.5, 84)],
  ),
  item(
    "doce-abobora",
    "Doce de abóbora",
    "Doces e conservas",
    "pote",
    "🎃",
    "baixo",
    ["doce-figo-ramy", "cocada-artesanal"],
    [p("roca", 14, 76)],
  ),
  item(
    "chips-mandioca",
    "Chips de mandioca",
    "Snacks",
    "pacote",
    "🍠",
    "medio",
    ["chips-batata"],
    [p("roca", 9.8, 34)],
  ),
  item(
    "chips-batata",
    "Chips de batata",
    "Snacks",
    "pacote",
    "🥔",
    "baixo",
    ["chips-mandioca"],
    [p("roca", 9.5, 62)],
  ),
  item(
    "bolo-milho",
    "Bolo de milho",
    "Massas e panificados",
    "unidade",
    "🌽",
    "baixo",
    ["bolo-mandioca", "pao-caseiro"],
    [p("roca", 24, 25)],
  ),
  item(
    "bolo-mandioca",
    "Bolo de mandioca",
    "Massas e panificados",
    "unidade",
    "🍰",
    "medio",
    ["bolo-milho", "bolo-brigadeiro"],
    [p("roca", 26, 18)],
  ),
  item(
    "bolo-brigadeiro",
    "Bolo recheado de brigadeiro",
    "Massas e panificados",
    "unidade",
    "🍫",
    "medio",
    ["bolo-abacaxi", "bolo-milho"],
    [p("roca", 48, 12)],
  ),
  item(
    "bolo-abacaxi",
    "Bolo recheado de abacaxi",
    "Massas e panificados",
    "unidade",
    "🍍",
    "medio",
    ["bolo-brigadeiro", "bolo-mandioca"],
    [p("roca", 46, 14)],
  ),
  item(
    "cafe-tradicional",
    "Café tradicional",
    "Cafés",
    "pacote",
    "☕",
    "baixo",
    ["cafe-especial", "cafe-gourmet"],
    [p("cafe", 18, 180)],
  ),
  item(
    "cafe-especial",
    "Café especial",
    "Cafés",
    "pacote",
    "☕",
    "baixo",
    ["cafe-gourmet", "cafe-organico"],
    [p("cafe", 32, 95)],
  ),
  item(
    "cafe-graos",
    "Café torrado em grãos",
    "Cafés",
    "pacote",
    "🫘",
    "baixo",
    ["cafe-especial", "cafe-gourmet"],
    [p("cafe", 35, 88)],
  ),
  item(
    "cafe-moido",
    "Café torrado e moído",
    "Cafés",
    "pacote",
    "☕",
    "baixo",
    ["cafe-tradicional", "cafe-especial"],
    [p("cafe", 22, 135)],
  ),
  item(
    "cafe-organico",
    "Café orgânico",
    "Cafés",
    "pacote",
    "🌱",
    "medio",
    ["cafe-especial", "cafe-gourmet"],
    [p("cafe", 38, 44)],
  ),
  item(
    "cafe-gourmet",
    "Café gourmet",
    "Cafés",
    "pacote",
    "☕",
    "medio",
    ["cafe-especial", "cafe-graos"],
    [p("cafe", 42, 36)],
  ),
];

export const BUYER_HISTORY: BuyerOrder[] = [
  {
    id: "2841",
    date: "18/05/2026",
    status: "Entregue",
    total: 842.4,
    estimatedSavings: 96.2,
    onTime: true,
    producers: ["Sítio Maria", "Ramy Pitayas", "Cozinha da Roça"],
  },
  {
    id: "2798",
    date: "11/05/2026",
    status: "Entregue",
    total: 611.9,
    estimatedSavings: 72.5,
    onTime: true,
    producers: ["Coop. Vale Verde", "Fazenda Cafezal"],
  },
  {
    id: "2712",
    date: "04/05/2026",
    status: "Entregue com ajuste",
    total: 538.7,
    estimatedSavings: 41.8,
    onTime: false,
    producers: ["Família Tanaka", "Cozinha da Roça"],
  },
];

export const MVP_METRICS = {
  orders: 32,
  onTimeRate: 94,
  fullFillRate: 88,
  missingItems: 7,
  averageSavings: 82.3,
  activeProducers: 6,
  activeBuyers: 5,
  transactedValue: 18420,
};

export function preferredProducer(product: Product): ProducerOption {
  return [...product.producers].sort((a, b) => {
    const scoreA = a.reliabilityScore * 20 + a.onTimeRate - a.price;
    const scoreB = b.reliabilityScore * 20 + b.onTimeRate - b.price;
    return scoreB - scoreA;
  })[0];
}

export function getProduct(id: string): Product | undefined {
  return CATALOG.find((product) => product.id === id);
}

export function getSubstitutes(product: Product): Product[] {
  return product.substitutes
    .map((id) => getProduct(id))
    .filter((product): product is Product => Boolean(product));
}

export function riskLabel(risk: RiskLevel) {
  if (risk === "alto") return "Risco alto";
  if (risk === "medio") return "Risco médio";
  return "Estoque seguro";
}
