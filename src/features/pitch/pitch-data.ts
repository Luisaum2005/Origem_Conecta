import {
  Boxes,
  CheckCircle2,
  Clock3,
  Eye,
  Handshake,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Search,
  ShoppingBasket,
  Sprout,
  Store,
  Truck,
  Users,
} from "lucide-react";

export const pitchSlides = [
  { label: "Gancho", duration: 30 },
  { label: "Conexão", duration: 20 },
  { label: "Persona", duration: 35 },
  { label: "O problema", duration: 30 },
  { label: "A solução", duration: 55 },
  { label: "Validação", duration: 50 },
  { label: "Convite", duration: 20 },
] as const;

export const painPoints = [
  { icon: MessageSquareText, text: "Conversa com vários fornecedores" },
  { icon: Search, text: "Não conhece alternativas locais" },
  { icon: Clock3, text: "Corre contra faltas e atrasos" },
] as const;

export const problemSteps = [
  { icon: ShoppingBasket, title: "Precisa abastecer", detail: "A demanda surge" },
  { icon: Search, title: "Busca demorada", detail: "Indicações e mensagens" },
  { icon: MessageSquareText, title: "Negocia disperso", detail: "Vários canais" },
  { icon: Truck, title: "Recebe tarde", detail: "Pouca previsibilidade" },
  { icon: Sprout, title: "Produtor perde", detail: "Estoque sem saída" },
] as const;

export const solutionBenefits = [
  {
    icon: Eye,
    title: "Visibilidade",
    detail: "Portfólio e disponibilidade em um só lugar.",
  },
  {
    icon: Handshake,
    title: "Negociação direta",
    detail: "Cotação, conversa e pedido conectados.",
  },
  {
    icon: PackageCheck,
    title: "Acompanhamento",
    detail: "Status claros do combinado à entrega.",
  },
] as const;

export const validationSignals = [
  { icon: Users, value: "10", label: "pessoas testaram", note: "5 compradores + 5 produtores" },
  { icon: CheckCircle2, value: "2", label: "lados validados", note: "quem compra e quem produz" },
  {
    icon: Boxes,
    value: "4",
    label: "métricas do piloto",
    note: "tempo, confiança, recompra e visibilidade",
  },
] as const;

export const pilotMetrics = ["Tempo de compra", "Clareza dos dados", "Recompra", "Vendas locais"];

export const audienceTypes = [
  { icon: Store, text: "Compradores profissionais" },
  { icon: Sprout, text: "Produtores rurais" },
  { icon: MapPin, text: "Negócios da região" },
] as const;
