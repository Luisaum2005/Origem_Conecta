import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ErrorMonitor } from "@/components/system/ErrorMonitor";
import { reportAppError } from "@/lib/error-monitor";
import { isBackendUnavailable } from "@/lib/supabase";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço informado não existe ou esta página foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  reportAppError(error, { source: "route-error-boundary" });
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Origem Conecta — Direto do produtor para sua cozinha" },
      {
        name: "description",
        content:
          "Plataforma B2B que conecta restaurantes a produtores rurais com entrega previsível e rastreável.",
      },
      { name: "author", content: "Origem Conecta" },
      { property: "og:title", content: "Origem Conecta — Direto do produtor para sua cozinha" },
      {
        property: "og:description",
        content:
          "Plataforma B2B que conecta restaurantes a produtores rurais com entrega previsível e rastreável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Origem Conecta — Direto do produtor para sua cozinha" },
      {
        name: "twitter:description",
        content:
          "Plataforma B2B que conecta restaurantes a produtores rurais com entrega previsível e rastreável.",
      },
      { property: "og:image", content: "/icon-512.png" },
      { name: "twitter:image", content: "/icon-512.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/icon-192.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "192x192",
        href: "/icon-192.png",
      },
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { CartProvider } from "@/lib/cart";
import { AuthProvider } from "@/lib/auth";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  if (isBackendUnavailable) return <BackendUnavailable />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorMonitor />
        <CartProvider>
          <Outlet />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function BackendUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-brand-900">Serviço temporariamente indisponível</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Não foi possível conectar a Origem Conecta com segurança. Tente novamente em alguns
          instantes. Nenhuma operação foi realizada neste dispositivo.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
