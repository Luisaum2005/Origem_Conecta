import { createFileRoute } from "@tanstack/react-router";
import { PitchPresentation } from "@/features/pitch/PitchPresentation";

export const Route = createFileRoute("/pitch")({
  head: () => ({
    meta: [
      { title: "Pitch de 4 minutos — Origem Conecta" },
      {
        name: "description",
        content: "Apresentação web do Origem Conecta para um pitch de quatro minutos.",
      },
    ],
  }),
  component: PitchPresentation,
});
