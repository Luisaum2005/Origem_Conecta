import type { SignUpInput } from "@/lib/auth-context";

export function buildSignupPayload(input: SignUpInput) {
  return {
    tipo: input.tipo,
    nome: input.nome,
    telefone: input.telefone,
    cidade: input.cidade,
    estado: input.estado,
    buyer: input.buyer,
    producer: input.producer,
    organization: input.organization,
  };
}
