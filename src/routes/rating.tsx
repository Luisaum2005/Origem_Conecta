import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ArrowLeft, Check, Star } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/rating")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Rating />
    </RequireProfile>
  ),
});

const HIGHLIGHTS = [
  "Produto fresco",
  "Bem embalado",
  "No horário",
  "Quantidade certa",
  "Atendimento",
];

function Rating() {
  const navigate = useNavigate();
  const [quality, setQuality] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [done, setDone] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[640px] px-4 py-8 pb-20 sm:px-6 sm:py-10 md:pb-10">
        <button
          onClick={() => navigate({ to: "/tracking" })}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand-900">
          Como foi sua entrega?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sua avaliação ajuda a calibrar a distribuição automática.
        </p>

        {done ? (
          <div className="mt-8 rounded-2xl border border-[var(--border-strong)] bg-[var(--color-success-bg)] p-6">
            <h2 className="font-semibold text-[var(--color-success-fg)]">Obrigado pelo retorno.</h2>
            <p className="mt-1 text-sm text-[var(--color-success-fg)]/80">
              Sua avaliação foi enviada aos produtores.
            </p>
          </div>
        ) : (
          <form
            className="mt-6 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (quality && punctuality) setDone(true);
            }}
          >
            <div className="surface-card divide-y divide-[var(--hairline)] px-4">
              <Stars label="Qualidade" value={quality} onChange={setQuality} />
              <Stars
                label="Pontualidade na entrega"
                value={punctuality}
                onChange={setPunctuality}
              />
            </div>
            <fieldset>
              <legend className="text-sm font-semibold text-brand-900">
                O que se destacou?{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {HIGHLIGHTS.map((tag) => {
                  const on = highlights.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      aria-pressed={on}
                      onClick={() =>
                        setHighlights((current) =>
                          on ? current.filter((item) => item !== tag) : [...current, tag],
                        )
                      }
                      className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                        on
                          ? "border border-leaf-300 bg-leaf-100 text-brand-900"
                          : "border border-[var(--hairline)] bg-white text-brand-900 shadow-xs"
                      }`}
                    >
                      {on && <Check className="h-4 w-4" />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="block">
              <span className="block text-sm font-medium text-brand-900">
                Comentário (opcional)
              </span>
              <textarea
                rows={4}
                placeholder="Conte um pouco sobre sua experiência…"
                className="surface-card mt-2 w-full rounded-2xl p-4 text-base placeholder:text-[var(--text-tertiary)] focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
              />
            </label>
            <button
              type="submit"
              disabled={!quality || !punctuality}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-900 px-6 text-sm font-semibold text-white hover:bg-brand-800 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
            >
              Enviar avaliação
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function Stars({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <span className="text-sm font-medium text-brand-900">{label}</span>
      <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= (hover || value);
          return (
            <button
              type="button"
              key={n}
              onMouseEnter={() => setHover(n)}
              onClick={() => onChange(n)}
              aria-label={`${n} de 5 estrelas em ${label}`}
              className="grid h-10 w-9 place-items-center rounded-lg transition active:scale-90"
            >
              <Star
                className={`h-7 w-7 ${filled ? "fill-orange-600 text-orange-600" : "text-[#cfd5cb]"}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
