import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { Star, ArrowLeft } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/rating")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <Rating />
    </RequireProfile>
  ),
});

function Rating() {
  const navigate = useNavigate();
  const [quality, setQuality] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [done, setDone] = useState(false);

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
            className="mt-8 space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
              if (quality && punctuality) setDone(true);
            }}
          >
            <Stars label="Qualidade dos produtos" value={quality} onChange={setQuality} />
            <Stars label="Pontualidade na entrega" value={punctuality} onChange={setPunctuality} />
            <label className="block">
              <span className="block text-sm font-medium text-brand-900">
                Comentário (opcional)
              </span>
              <textarea
                rows={4}
                placeholder="Conte um pouco sobre sua experiência…"
                className="mt-2 w-full rounded-xl border border-border bg-white p-4 text-base placeholder:text-[var(--text-tertiary)] focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
              />
            </label>
            <button
              type="submit"
              disabled={!quality || !punctuality}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-900 px-6 text-sm font-semibold text-white hover:bg-brand-800 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
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
    <div>
      <span className="block text-sm font-medium text-brand-900">{label}</span>
      <div className="mt-3 flex gap-2" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= (hover || value);
          return (
            <button
              type="button"
              key={n}
              onMouseEnter={() => setHover(n)}
              onClick={() => onChange(n)}
              className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-white transition hover:border-orange-500"
            >
              <Star
                className={`h-6 w-6 ${filled ? "fill-orange-600 text-orange-600" : "text-border"}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
