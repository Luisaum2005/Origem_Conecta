import { createFileRoute } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  isOrganizationProductOutdated,
  setOrganizationProductPaused,
  useOrganizationProducts,
  type OrganizationProduct,
} from "@/lib/organization-products";
import { AlertTriangle, Boxes, CalendarClock, Package, PauseCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "organization-paused" | "producer-paused" | "outdated";

export const Route = createFileRoute("/organizations/products")({
  component: () => (
    <RequireProfile roles={["gestor_organizacao"]}>
      <OrganizationProductsPage />
    </RequireProfile>
  ),
});

function OrganizationProductsPage() {
  const { products, loading, error, refresh } = useOrganizationProducts();
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState("");
  const [confirmation, setConfirmation] = useState<OrganizationProduct | null>(null);

  const organizations = useMemo(
    () =>
      Array.from(
        new Map(products.map((product) => [product.organizationId, product.organizationName])),
      ),
    [products],
  );
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      if (organizationId !== "all" && product.organizationId !== organizationId) return false;
      if (
        query &&
        ![product.productName, product.producerName, product.propertyName].some((value) =>
          value.toLocaleLowerCase("pt-BR").includes(query),
        )
      ) {
        return false;
      }
      if (status === "active") return product.active && !product.organizationPaused;
      if (status === "organization-paused") return product.organizationPaused;
      if (status === "producer-paused") return !product.active && !product.organizationPaused;
      if (status === "outdated") return isOrganizationProductOutdated(product.updatedAt);
      return true;
    });
  }, [organizationId, products, search, status]);

  const changePause = async () => {
    if (!confirmation) return;
    const product = confirmation;
    const nextPaused = !product.organizationPaused;
    setConfirmation(null);
    setBusy(product.id);
    try {
      await setOrganizationProductPaused(product.id, nextPaused);
      toast.success(
        nextPaused
          ? "Publicação pausada pela organização."
          : "Publicação liberada. O produtor já pode publicá-la novamente.",
      );
      await refresh();
    } catch (actionError) {
      toast.error(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível alterar a publicação.",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-24 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Gestão institucional
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">Produtos da organização</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Acompanhe os produtos publicados pelos associados usando os dados comerciais da
          organização. Estoque e informações do produto continuam sob responsabilidade do produtor.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Resumo das publicações">
          <Summary
            label="Publicados"
            value={products.filter((product) => product.active).length}
            icon={Package}
          />
          <Summary
            label="Pausados pela organização"
            value={products.filter((product) => product.organizationPaused).length}
            icon={PauseCircle}
          />
          <Summary
            label="Precisam de atualização"
            value={
              products.filter((product) => isOrganizationProductOutdated(product.updatedAt)).length
            }
            icon={CalendarClock}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-white p-4 shadow-xs">
          <h2 className="font-bold text-brand-900">Filtrar produtos</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <label htmlFor="organization-product-search" className="sr-only">
                Buscar produtos
              </label>
              <input
                id="organization-product-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto, produtor ou propriedade"
                className="h-12 w-full rounded-xl border border-border pl-10 pr-3 text-base"
              />
            </div>
            <label className="sr-only" htmlFor="organization-product-organization">
              Organização
            </label>
            <select
              id="organization-product-organization"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="h-12 rounded-xl border border-border bg-white px-3 text-base text-brand-900"
            >
              <option value="all">Todas as organizações</option>
              {organizations.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="organization-product-status">
              Situação
            </label>
            <select
              id="organization-product-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="h-12 rounded-xl border border-border bg-white px-3 text-base text-brand-900"
            >
              <option value="all">Todas as situações</option>
              <option value="active">Publicados</option>
              <option value="organization-paused">Pausados pela organização</option>
              <option value="producer-paused">Pausados pelo produtor</option>
              <option value="outdated">Precisam de atualização</option>
            </select>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800" role="alert">
            <p>Não foi possível carregar os produtos da organização.</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 min-h-10 font-semibold underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-white p-10 text-center">
            <Boxes className="mx-auto h-10 w-10 text-leaf-700" />
            <h2 className="mt-3 text-lg font-bold text-brand-900">Nenhum produto encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length === 0
                ? "Os produtos aparecerão aqui quando um associado autorizado publicar usando a organização."
                : "Tente remover algum filtro ou buscar por outro termo."}
            </p>
          </div>
        ) : (
          <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Produtos encontrados">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                busy={busy === product.id}
                onChangePause={() => setConfirmation(product)}
              />
            ))}
          </section>
        )}
      </main>

      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.organizationPaused ? "Liberar publicação" : "Pausar publicação"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.organizationPaused
                ? "O bloqueio institucional será removido. Por segurança, o produtor ainda precisará publicar o produto novamente."
                : "O produto sairá imediatamente do portfólio. O estoque do produtor não será alterado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void changePause()}>
              {confirmation?.organizationPaused ? "Liberar" : "Pausar produto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductCard({
  product,
  busy,
  onChangePause,
}: {
  product: OrganizationProduct;
  busy: boolean;
  onChangePause: () => void;
}) {
  const outdated = isOrganizationProductOutdated(product.updatedAt);
  const belowMinimum =
    product.minimumStock > 0 && product.availableQuantity <= product.minimumStock;
  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-leaf-700">
            {product.organizationName}
          </p>
          <h2 className="mt-1 text-xl font-bold text-brand-900">{product.productName}</h2>
        </div>
        <ProductStatus product={product} />
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Info label="Produtor responsável" value={product.producerName} />
        <Info label="Propriedade" value={product.propertyName} />
        <Info
          label="Quantidade disponível"
          value={`${product.availableQuantity.toLocaleString("pt-BR")} ${product.unit}`}
        />
        <Info
          label="Última atualização"
          value={new Date(product.updatedAt).toLocaleDateString("pt-BR")}
        />
      </dl>
      {(outdated || belowMinimum) && (
        <div className="mt-4 space-y-2">
          {outdated && <Warning text="Este produto não é atualizado há mais de 30 dias." />}
          {belowMinimum && (
            <Warning text="A quantidade disponível chegou ao estoque mínimo informado pelo produtor." />
          )}
        </div>
      )}
      {(product.active || product.organizationPaused) && (
        <button
          type="button"
          disabled={busy}
          onClick={onChangePause}
          className={`mt-5 min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 ${
            product.organizationPaused
              ? "border border-border text-brand-900"
              : "border border-red-200 text-red-700"
          }`}
        >
          {busy
            ? "Aguarde..."
            : product.organizationPaused
              ? "Liberar para o produtor republicar"
              : "Pausar publicação"}
        </button>
      )}
    </article>
  );
}

function ProductStatus({ product }: { product: OrganizationProduct }) {
  const label = product.organizationPaused
    ? "Pausado pela organização"
    : product.active
      ? "Publicado"
      : "Pausado pelo produtor";
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        product.organizationPaused
          ? "bg-orange-100 text-orange-800"
          : product.active
            ? "bg-green-100 text-green-800"
            : "bg-secondary text-brand-900"
      }`}
    >
      {label}
    </span>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Package;
}) {
  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-xs">
      <Icon className="h-6 w-6 text-leaf-700" />
      <p className="mt-3 text-3xl font-bold text-brand-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-brand-900">{value}</dd>
    </div>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {text}
    </p>
  );
}
