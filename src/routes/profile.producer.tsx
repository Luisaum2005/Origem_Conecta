import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { SupplierProductPicker } from "@/components/forms/SupplierProductPicker";
import { FormSection } from "@/components/forms/FormSection";
import { PushSettings } from "@/components/notifications/PushSettings";
import { ProducerMemberships } from "@/components/organizations/ProducerMemberships";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { useAuth } from "@/lib/auth";
import { formatOrderDate, type SavedOrder, useOrders } from "@/lib/orders";
import { type ProducerProfileDetails, useProducerProfileDetails } from "@/lib/producer-profile";
import { useProducerStock } from "@/lib/producer-stock";
import { CepLookupError, lookupAddressByCep } from "@/lib/cep";
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sprout,
  Store,
  TrendingUp,
  Truck,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/profile/producer")({
  component: () => (
    <RequireProfile allowed={["produtor"]}>
      <ProducerProfile />
    </RequireProfile>
  ),
});

const PRODUCER_ID = "produtor";
const PRODUCER_NAME = "Produtor";

function ProducerProfile() {
  const { profile, isSupabaseConfigured } = useAuth();
  const {
    details,
    saveDetails,
    saving,
    loading: profileLoading,
    error: profileError,
    reload: reloadProfile,
  } = useProducerProfileDetails();
  const [stock, , stockResource] = useProducerStock();
  const { orders, loading: ordersLoading, error: ordersError, reload: reloadOrders } = useOrders();
  const producerName =
    details.propertyName || (profile?.tipo === "produtor" ? profile.nome : PRODUCER_NAME);

  const activeStock = stock.filter((item) => item.status === "ativo");
  const pausedStock = stock.filter((item) => item.status === "pausado");
  const producerOrders = getProducerOrders(
    orders,
    Boolean(isSupabaseConfigured && profile?.tipo === "produtor"),
  );
  const activeOrders = producerOrders.filter((order) => order.status !== "Cancelado");
  const openOrders = activeOrders.filter((order) => order.status !== "Entregue");
  const deliveredOrders = activeOrders.filter((order) => order.status === "Entregue");
  const stockPotential = activeStock.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
    0,
  );
  const orderRevenue = activeOrders.reduce((sum, order) => sum + producerOrderTotal(order), 0);
  const deliveryRate = activeOrders.length
    ? Math.round((deliveredOrders.length / activeOrders.length) * 100)
    : 0;
  const topProducts = productSummary(producerOrders);
  const activity = buildActivity(producerOrders, stock);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-6 pb-24 sm:px-8 sm:py-10 md:pb-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
          Painel do produtor
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              {producerName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Produtor verificado - {details.location || "localização pendente"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/producer/orders"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-leaf-500 hover:text-brand-900"
            >
              <Store className="h-3.5 w-3.5 text-leaf-600" />
              Ver negociações recebidas
            </Link>
            <Link
              to="/production"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-leaf-500 hover:text-brand-900"
            >
              <Sprout className="h-3.5 w-3.5 text-leaf-600" />
              Gerenciar estoque
            </Link>
          </div>
        </div>

        {(profileLoading || stockResource.loading || ordersLoading) &&
          !profileError &&
          !stockResource.error &&
          !ordersError && (
            <div className="mt-6">
              <DataLoading label="Atualizando seu painel..." />
            </div>
          )}
        {profileError && (
          <div className="mt-6">
            <DataLoadError message={profileError} onRetry={reloadProfile} />
          </div>
        )}
        {stockResource.error && (
          <div className="mt-6">
            <DataLoadError message={stockResource.error} onRetry={stockResource.reload} />
          </div>
        )}
        {ordersError && (
          <div className="mt-6">
            <DataLoadError message={ordersError} onRetry={reloadOrders} />
          </div>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Package} label="Produtos ativos" value={`${activeStock.length}`} />
          <Metric icon={Truck} label="Negociações em andamento" value={`${openOrders.length}`} />
          <Metric
            icon={CircleDollarSign}
            label="Valor anunciado nas solicitações"
            value={`R$ ${orderRevenue.toFixed(2)}`}
          />
          <Metric
            icon={ShieldCheck}
            label="Negociações concluídas"
            value={producerOrders.length ? `${deliveryRate}%` : "Sem dados"}
          />
        </section>

        {!profileLoading && !profileError && (
          <section className="mt-6">
            <ProducerDetailsPanel details={details} onSave={saveDetails} saving={saving} />
          </section>
        )}

        <ProducerMemberships />

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Estoque publicado" icon={Package}>
            {stock.length === 0 ? (
              <EmptyMessage text="Nenhum produto cadastrado no estoque." />
            ) : (
              <ul className="divide-y divide-border">
                {stock.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-brand-900">{item.product}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.status === "ativo"
                              ? "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]"
                              : "bg-surface-muted text-muted-foreground"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.notes || "Sem observações adicionais"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-900">
                        {item.quantity || "0"} {item.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R$ {Number(item.price || 0).toFixed(2)}/{item.unit}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/production"
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-leaf-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-leaf-700 active:scale-[0.99] sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar disponibilidade
            </Link>
          </Panel>

          <Panel title="Produtos mais vendidos" icon={TrendingUp}>
            {topProducts.length === 0 ? (
              <EmptyMessage text="Os produtos mais vendidos aparecem depois do primeiro pedido." />
            ) : (
              <ul className="space-y-3">
                {topProducts.map((product) => (
                  <li key={product.name} className="rounded-xl border border-border bg-canvas p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-brand-900">{product.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {product.quantity} {product.unit} vendidos
                        </p>
                      </div>
                      <p className="text-sm font-bold text-brand-900">
                        R$ {product.total.toFixed(2)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="Resumo operacional" icon={PackageCheck}>
            <dl className="grid gap-4">
              <Mini label="Potencial do estoque ativo" value={`R$ ${stockPotential.toFixed(2)}`} />
              <Mini label="Pedidos recebidos" value={`${producerOrders.length}`} />
              <Mini label="Produtos pausados" value={`${pausedStock.length}`} />
              <Mini label="Próxima entrega" value={nextDeliveryLabel(openOrders)} />
            </dl>
          </Panel>

          <Panel title="Alertas de operação" icon={AlertTriangle}>
            <div className="space-y-3">
              {openOrders.length > 0 && (
                <Alert
                  title="Pedidos aguardando ação"
                  text={`${openOrders.length} pedido(s) ainda em andamento.`}
                />
              )}
              {pausedStock.length > 0 && (
                <Alert
                  title="Produtos pausados"
                  text={`${pausedStock.length} produto(s) fora do portfólio.`}
                />
              )}
              {activeStock.length === 0 && (
                <Alert
                  title="Sem estoque ativo"
                  text="Publique ao menos um produto para aparecer ao comprador."
                />
              )}
              {openOrders.length === 0 && pausedStock.length === 0 && activeStock.length > 0 && (
                <Alert
                  title="Operação em dia"
                  text="Estoque ativo e nenhum pedido pendente no momento."
                />
              )}
            </div>
          </Panel>

          <Panel title="Histórico operacional" icon={CalendarClock}>
            {activity.length === 0 ? (
              <EmptyMessage text="As movimentacoes aparecem quando houver estoque ou pedidos." />
            ) : (
              <ul className="space-y-3">
                {activity.map((event) => (
                  <li
                    key={event}
                    className="rounded-xl bg-canvas px-4 py-3 text-sm font-medium text-brand-900"
                  >
                    {event}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
        <PushSettings />
      </main>
    </div>
  );
}

function getProducerOrders(orders: SavedOrder[], alreadyScoped: boolean) {
  if (alreadyScoped) return orders.filter((order) => order.items.length > 0);
  return orders
    .map((order) => ({
      ...order,
      items: order.items.filter((item) => item.producerId === PRODUCER_ID),
    }))
    .filter((order) => order.items.length > 0);
}

function producerOrderTotal(order: SavedOrder) {
  return order.items.reduce((sum, item) => sum + item.lineTotal, 0);
}

function productSummary(orders: SavedOrder[]) {
  const map = new Map<string, { name: string; quantity: number; unit: string; total: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = map.get(item.productName) ?? {
        name: item.productName,
        quantity: 0,
        unit: item.unit,
        total: 0,
      };
      current.quantity += item.quantity;
      current.total += item.lineTotal;
      map.set(item.productName, current);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

function nextDeliveryLabel(orders: SavedOrder[]) {
  if (!orders.length) return "Sem pedidos abertos";
  return orders[0].deliveryEta;
}

function buildActivity(orders: SavedOrder[], stock: { product: string; status: string }[]) {
  const orderEvents = orders.slice(0, 3).map((order) => {
    return `Pedido #${order.id} - ${order.status} - ${formatOrderDate(order.createdAt)}`;
  });
  const stockEvents = stock.slice(0, 2).map((item) => {
    return `${item.product} ${item.status === "ativo" ? "publicado" : "pausado"} no estoque`;
  });
  return [...orderEvents, ...stockEvents].slice(0, 5);
}

function ProducerDetailsPanel({
  details,
  onSave,
  saving,
}: {
  details: ProducerProfileDetails;
  onSave: (details: ProducerProfileDetails) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(details);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [cepStatus, setCepStatus] = useState("");
  const [searchingCep, setSearchingCep] = useState(false);
  const cepRequestRef = useRef<AbortController | null>(null);
  const addressNumberRef = useRef<HTMLInputElement>(null);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(details);
  const missingFields = getMissingProducerProfileFields(details);

  useEffect(() => {
    setDraft(details);
  }, [details]);

  useEffect(() => () => cepRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!editing || !isDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [editing, isDirty]);

  const searchCep = async () => {
    const postalCode = draft.postalCode.replace(/\D/g, "");
    if (postalCode.length !== 8) {
      setCepStatus(postalCode.length ? "Informe um CEP com 8 n\u00fameros." : "");
      return;
    }

    cepRequestRef.current?.abort();
    const controller = new AbortController();
    cepRequestRef.current = controller;
    setSearchingCep(true);
    setCepStatus("Buscando endere\u00e7o...");

    try {
      const address = await lookupAddressByCep(postalCode, controller.signal);
      setDraft((current) => ({
        ...current,
        postalCode,
        addressLine: address.street || current.addressLine,
        neighborhood: address.neighborhood || current.neighborhood,
        city: address.city || current.city,
        state: address.state || current.state,
      }));
      setCepStatus(`Endere\u00e7o preenchido via ${address.source}.`);
      window.setTimeout(() => addressNumberRef.current?.focus(), 0);
    } catch (lookupError) {
      if (controller.signal.aborted) return;
      setCepStatus(
        lookupError instanceof CepLookupError && lookupError.reason === "not_found"
          ? "CEP n\u00e3o encontrado. Confira o n\u00famero ou preencha o endere\u00e7o manualmente."
          : "N\u00e3o foi poss\u00edvel consultar o CEP agora. Preencha o endere\u00e7o manualmente.",
      );
    } finally {
      if (cepRequestRef.current === controller) {
        cepRequestRef.current = null;
        setSearchingCep(false);
      }
    }
  };

  const save = async () => {
    setError("");
    const validationError = validateProducerProfile(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await onSave(draft);
      setEditing(false);
      setNotice("Dados do produtor atualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar os dados.");
    }
  };

  return (
    <Panel title="Dados da propriedade" icon={Store}>
      {!editing ? (
        <div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Mini label="Propriedade" value={details.propertyName || "Não informado"} />
            <Mini label="Responsável" value={details.responsibleName || "Não informado"} />
            <Mini label="CNPJ" value={details.cnpj || "Não informado"} />
            <Mini
              label="Comercialização"
              value={commercializationLabel(details.commercializationMode)}
            />
            <Mini label="Telefone" value={details.phone || "Não informado"} />
            <Mini label="Localização" value={details.location || "Não informado"} />
            <Mini
              label="Endereço cadastrado"
              value={formatProducerAddress(details) || "Não informado"}
            />
          </dl>
          {missingFields.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Complete seu perfil para facilitar as negociações.</p>
              <p className="mt-1">Faltam: {missingFields.join(", ")}.</p>
            </div>
          )}
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Produtos atendidos
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {details.products.length ? (
                details.products.map((product) => (
                  <span
                    key={product}
                    className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-semibold text-brand-900"
                  >
                    {product}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Nenhum produto informado.</span>
              )}
            </div>
          </div>
          {notice && (
            <p className="mt-4 text-sm font-semibold text-[var(--color-success-fg)]">{notice}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setError("");
              setEditing(true);
            }}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
          >
            <Pencil className="h-4 w-4 text-leaf-700" />
            {missingFields.length ? "Completar perfil" : "Editar dados"}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4">
            <FormSection
              title={"Identifica\u00e7\u00e3o da propriedade"}
              caption={"Campos com * s\u00e3o obrigat\u00f3rios."}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  icon={Store}
                  label="Nome da propriedade"
                  value={draft.propertyName}
                  onChange={(propertyName) => setDraft({ ...draft, propertyName })}
                  required
                  autoComplete="organization"
                />
                <TextField
                  icon={User}
                  label="Responsável"
                  value={draft.responsibleName}
                  onChange={(responsibleName) => setDraft({ ...draft, responsibleName })}
                  required
                  autoComplete="name"
                />
              </div>
            </FormSection>
            <FormSection
              title={"Forma de comercializa\u00e7\u00e3o"}
              caption={"A escolha define quais dados comerciais ser\u00e3o solicitados."}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="block text-sm font-medium text-brand-900">
                    Como pretende comercializar
                  </span>
                  <select
                    value={draft.commercializationMode}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        commercializationMode: event.target
                          .value as typeof draft.commercializationMode,
                      })
                    }
                    className="mt-2 h-12 w-full rounded-xl border border-border bg-white px-4 text-sm text-brand-900"
                  >
                    <option value="own">Em nome próprio</option>
                    <option value="organization">Por cooperativa ou associação</option>
                    <option value="undecided">Ainda estou definindo</option>
                  </select>
                </label>
                {draft.commercializationMode === "own" && (
                  <>
                    <TextField
                      icon={Store}
                      label="CNPJ próprio, se possuir"
                      value={draft.cnpj}
                      onChange={(cnpj) => setDraft({ ...draft, cnpj: formatCnpj(cnpj) })}
                      inputMode="numeric"
                      placeholder="Digite o CNPJ"
                    />
                    <TextField
                      icon={Store}
                      label="CAEPF, se aplicável"
                      value={draft.caepf}
                      onChange={(caepf) => setDraft({ ...draft, caepf: onlyDigits(caepf, 14) })}
                      inputMode="numeric"
                    />
                    <TextField
                      icon={Store}
                      label="Inscrição estadual, se aplicável"
                      value={draft.stateRegistration}
                      onChange={(stateRegistration) => setDraft({ ...draft, stateRegistration })}
                    />
                  </>
                )}
              </div>
            </FormSection>
            <FormSection
              title={"Contato e endere\u00e7o"}
              caption={"Use o CEP para preencher o endere\u00e7o e confira o n\u00famero."}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  icon={Phone}
                  label="Telefone/WhatsApp"
                  value={draft.phone}
                  onChange={(phone) => setDraft({ ...draft, phone: formatPhone(phone) })}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                />
                <div>
                  <TextField
                    icon={MapPin}
                    label="CEP"
                    value={draft.postalCode}
                    onChange={(postalCode) => {
                      cepRequestRef.current?.abort();
                      setCepStatus("");
                      setDraft({ ...draft, postalCode: formatPostalCode(postalCode) });
                    }}
                    onBlur={() => void searchCep()}
                    placeholder="00000-000"
                    inputMode="numeric"
                    helper={cepStatus}
                    required
                    autoComplete="postal-code"
                  />
                  <button
                    type="button"
                    onClick={() => void searchCep()}
                    disabled={searchingCep}
                    className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    <Search className="h-4 w-4 text-leaf-700" />
                    {searchingCep ? "Buscando CEP..." : "Buscar CEP"}
                  </button>
                </div>
                <TextField
                  icon={MapPin}
                  label="Logradouro"
                  value={draft.addressLine}
                  onChange={(addressLine) => setDraft({ ...draft, addressLine })}
                  placeholder="Rua, avenida..."
                  required
                  autoComplete="address-line1"
                />
                <TextField
                  icon={MapPin}
                  label="Número"
                  value={draft.addressNumber}
                  onChange={(addressNumber) => setDraft({ ...draft, addressNumber })}
                  inputRef={addressNumberRef}
                  autoComplete="address-line2"
                />
                <TextField
                  icon={MapPin}
                  label="Complemento"
                  value={draft.addressComplement}
                  onChange={(addressComplement) => setDraft({ ...draft, addressComplement })}
                />
                <TextField
                  icon={MapPin}
                  label="Bairro"
                  value={draft.neighborhood}
                  onChange={(neighborhood) => setDraft({ ...draft, neighborhood })}
                  required
                  autoComplete="address-level3"
                />
                <TextField
                  icon={MapPin}
                  label="Município"
                  value={draft.city}
                  onChange={(city) => setDraft({ ...draft, city })}
                  required
                  autoComplete="address-level2"
                />
                <TextField
                  icon={MapPin}
                  label="UF"
                  value={draft.state}
                  onChange={(state) => setDraft({ ...draft, state: formatState(state) })}
                  placeholder="SP"
                  required
                  maxLength={2}
                  autoComplete="address-level1"
                />
              </div>
            </FormSection>
          </div>
          <FormSection
            title="Produtos atendidos"
            caption={"Informe o que voc\u00ea produz ou fornece."}
          >
            <SupplierProductPicker
              value={draft.products}
              onChange={(products) => setDraft({ ...draft, products })}
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">
              Esta lista representa tudo que você fornece. O estoque publicado pode conter apenas os
              produtos disponíveis no momento.
            </span>
          </FormSection>
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white/95 p-3 shadow-lg backdrop-blur">
            {isDirty && (
              <p className="mr-auto text-sm font-medium text-amber-800">
                {"Altera\u00e7\u00f5es n\u00e3o salvas."}
              </p>
            )}
            {error && (
              <p className="w-full rounded-xl bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error-fg)]">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-leaf-600 px-4 text-sm font-semibold text-white hover:bg-leaf-700 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar dados"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(details);
                setError("");
                setEditing(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:border-leaf-500"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function onlyDigits(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, "");
  return maxLength ? digits.slice(0, maxLength) : digits;
}

function formatPostalCode(value: string) {
  const digits = onlyDigits(value, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function formatPhone(value: string) {
  const digits = onlyDigits(value, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatState(value: string) {
  return value
    .replace(/[^a-z]/gi, "")
    .slice(0, 2)
    .toUpperCase();
}

function getMissingProducerProfileFields(details: ProducerProfileDetails) {
  const fields = [
    ["nome da propriedade", details.propertyName],
    ["respons\u00e1vel", details.responsibleName],
    ["telefone", details.phone.replace(/\D/g, "").length >= 10 ? "ok" : ""],
    ["CEP", details.postalCode.replace(/\D/g, "").length === 8 ? "ok" : ""],
    ["logradouro", details.addressLine],
    ["bairro", details.neighborhood],
    ["munic\u00edpio", details.city],
    ["UF", details.state.length === 2 ? "ok" : ""],
  ];
  return fields.filter(([, value]) => !value.trim()).map(([label]) => label);
}

function validateProducerProfile(details: ProducerProfileDetails) {
  const missing = getMissingProducerProfileFields(details);
  if (missing.length) return `Complete os campos obrigat\u00f3rios: ${missing.join(", ")}.`;
  return "";
}

function commercializationLabel(mode: "own" | "organization" | "undecided") {
  if (mode === "own") return "Em nome próprio";
  if (mode === "organization") return "Por organização";
  return "Ainda não definida";
}

function formatProducerAddress(details: ProducerProfileDetails) {
  if (!details.addressLine || !details.city || !details.state) return "";
  const street = [details.addressLine, details.addressNumber].filter(Boolean).join(", ");
  return [
    street,
    details.addressComplement,
    details.neighborhood,
    `${details.city}, ${details.state}`,
  ]
    .filter(Boolean)
    .join(" - ");
}

function TextField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  onBlur,
  inputMode,
  helper,
  required = false,
  autoComplete,
  maxLength,
  inputRef,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onBlur?: () => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  helper?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">
        {label} {required && <span className="text-[var(--color-error-fg)]">*</span>}
      </span>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-white px-3 focus-within:border-leaf-600 focus-within:ring-2 focus-within:ring-leaf-100">
        {Icon && <Icon className="h-4 w-4 text-leaf-700" />}
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required={required}
          placeholder={placeholder}
          className="h-11 w-full bg-transparent text-sm text-brand-900 focus:outline-none"
        />
      </div>
      {helper && (
        <span className="mt-1.5 block text-xs text-muted-foreground" aria-live="polite">
          {helper}
        </span>
      )}
    </label>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-xs sm:p-6">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold text-brand-900">
        <Icon className="h-4 w-4 text-leaf-700" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-100 text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-brand-900">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-brand-900">{value}</dd>
    </div>
  );
}

function Alert({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-canvas p-4">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="rounded-xl bg-canvas p-4 text-sm text-muted-foreground">{text}</p>;
}
