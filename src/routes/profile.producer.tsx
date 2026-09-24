import { createFileRoute, useRouter } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { SupplierProductPicker } from "@/components/forms/SupplierProductPicker";
import { FormSection } from "@/components/forms/FormSection";
import { PushSettings } from "@/components/notifications/PushSettings";
import { ProducerMemberships } from "@/components/organizations/ProducerMemberships";
import { DataLoadError } from "@/components/system/DataLoadState";
import { supportHref } from "@/lib/support";
import { ListRow, TextSizeOptions } from "@/components/mobile/ProfileParts";
import { Sheet } from "@/components/mobile/Sheet";
import { InstallButton } from "@/components/pwa/InstallButton";
import { getProducerId } from "@/lib/orders";
import { readLocalRatings } from "@/lib/ratings";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { type SavedOrder, useOrders } from "@/lib/orders";
import {
  hasMissingProducerProducts,
  type ProducerProfileDetails,
  useProducerProfileDetails,
} from "@/lib/producer-profile";
import { requestCatalogProduct } from "@/lib/product-catalog";
import { CepLookupError, lookupAddressByCep } from "@/lib/cep";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Home,
  LifeBuoy,
  LogOut,
  Settings,
  Share2,
  Sparkles,
  Users,
  MapPin,
  Package,
  Pencil,
  Phone,
  Save,
  Search,
  Store,
  User,
  X,
} from "@/components/mobile/icons";
import { useEffect, useRef, useState } from "react";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/profile/producer")({
  component: () => (
    <RequireProfile allowed={["produtor"]}>
      <ProducerProfile />
    </RequireProfile>
  ),
});

const PRODUCER_ID = "produtor";

function ProducerProfile() {
  const { profile, isSupabaseConfigured, signOut } = useAuth();
  const router = useRouter();
  const {
    details,
    saveDetails,
    saving,
    loading: profileLoading,
    error: profileError,
    reload: reloadProfile,
  } = useProducerProfileDetails();
  const { orders } = useOrders();
  const [sheet, setSheet] = useState<
    "details" | "memberships" | "notifications" | "settings" | null
  >(null);
  const [ratingAverage, setRatingAverage] = useState<string>("—");
  const [editProductsRequested, setEditProductsRequested] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("edit") === "products";
    setEditProductsRequested(requested);
    if (requested) setSheet("details");
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    void (async () => {
      const producerId = await getProducerId(profile.id);
      if (!producerId) return;
      let values: number[] = [];
      if (supabase && isSupabaseConfigured) {
        const { data } = await supabase
          .from("buyer_ratings")
          .select("rating")
          .eq("producer_id", producerId);
        values = (data ?? []).map((row: { rating: number }) => row.rating);
      } else {
        values = readLocalRatings()
          .filter((rating) => rating.producerId === producerId)
          .map((rating) => rating.rating);
      }
      if (active && values.length)
        setRatingAverage(
          (values.reduce((sum, value) => sum + value, 0) / values.length).toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          }),
        );
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [profile, isSupabaseConfigured]);

  const producerOrders = getProducerOrders(
    orders,
    Boolean(isSupabaseConfigured && profile?.tipo === "produtor"),
  );
  const finished = producerOrders.filter((order) => order.status !== "Cancelado");
  const delivered = finished.filter((order) => order.status === "Entregue");
  const onTime = delivered.filter(
    (order) =>
      !order.deliveryAt ||
      !order.deliveredAt ||
      new Date(order.deliveredAt).getTime() <= new Date(order.deliveryAt).getTime() + 2 * 36e5,
  );
  const onTimeRate = delivered.length
    ? `${Math.round((onTime.length / delivered.length) * 100)}%`
    : "—";
  const missing = getMissingProducerProfileFields(details);
  const address = formatProducerAddress(details);
  const name = details.propertyName || profile?.nome || "Sua propriedade";

  const back = () => {
    if (window.history.length > 1) router.history.back();
    else void router.navigate({ to: "/producer/orders" });
  };
  const share = async () => {
    const text = `${name} — ${details.location || ""} no Origem Conecta`;
    try {
      if (navigator.share)
        await navigator.share({ title: name, text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        toast.success("Link copiado");
      }
    } catch {
      /* compartilhamento cancelado */
    }
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-p5-perfil">
        <div className="m-cover">
          <img src="/img/campo.jpg" alt="" />
          <div className="m-veil" />
          <div className="m-status" />
          <div className="m-cb">
            <button type="button" className="m-round m-glass" onClick={back} aria-label="Voltar">
              <ArrowLeft className="lucide" aria-hidden />
            </button>
            <button
              type="button"
              className="m-round m-glass"
              onClick={() => void share()}
              aria-label="Compartilhar perfil"
            >
              <Share2 className="lucide" aria-hidden />
            </button>
          </div>
        </div>

        <div className="m-me m-card">
          <div className="m-top">
            <span className="m-avatar m-big" style={{ border: "3px solid #fff" }}>
              {initials(name) || "?"}
            </span>
            {details.commercialVerificationStatus === "verified" && (
              <span className="m-chip m-leaf">
                <BadgeCheck className="lucide" aria-hidden />
                Verificado
              </span>
            )}
          </div>
          <b>{name}</b>
          <span>
            {[details.responsibleName, details.location].filter(Boolean).join(" · ") ||
              "Complete os dados da propriedade"}
          </span>
          <div className="m-kp">
            <div>
              <strong>{onTimeRate}</strong>
              <em>no prazo</em>
            </div>
            <div>
              <strong>{ratingAverage}</strong>
              <em>nota</em>
            </div>
            <div>
              <strong>{delivered.length}</strong>
              <em>entregas</em>
            </div>
          </div>
        </div>

        {profileError && (
          <div className="m-pad">
            <DataLoadError message={profileError} onRetry={reloadProfile} />
          </div>
        )}

        {!profileLoading && missing.length > 0 && (
          <button type="button" className="m-alert" onClick={() => setSheet("details")}>
            <Sparkles className="lucide" aria-hidden />
            <div>
              <b>Complete seu perfil</b>
              <span>
                Falta {missing.slice(0, 2).join(" e ")}
                {missing.length > 2 ? ` e mais ${missing.length - 2}` : ""} para aparecer em
                destaque.
              </span>
            </div>
          </button>
        )}

        <div className="m-grp m-card">
          <ListRow
            icon={<Home className="lucide" aria-hidden />}
            title="Dados da propriedade"
            subtitle="Área, responsável, CAEPF"
            warn={missing.length > 0}
            onClick={() => setSheet("details")}
          />
          <ListRow
            icon={<Store className="lucide" aria-hidden />}
            title="Como você vende"
            subtitle={commercializationLabel(details.commercializationMode)}
            onClick={() => setSheet("details")}
          />
          <ListRow
            icon={<Users className="lucide" aria-hidden />}
            title="Cooperativas"
            subtitle="Vínculos e convites"
            onClick={() => setSheet("memberships")}
          />
          <ListRow
            icon={<MapPin className="lucide" aria-hidden />}
            title="Local de coleta"
            subtitle={address || "Informe o endereço de coleta"}
            onClick={() => setSheet("details")}
          />
          <ListRow
            icon={<Bell className="lucide" aria-hidden />}
            title="Notificações"
            subtitle="Pedidos, demandas e mensagens"
            onClick={() => setSheet("notifications")}
          />
        </div>

        <div className="m-grp m-card">
          <ListRow
            icon={<Settings className="lucide" aria-hidden />}
            title="Ajustes"
            subtitle="Tamanho do texto e instalar o app"
            onClick={() => setSheet("settings")}
          />
          <ListRow
            icon={<LifeBuoy className="lucide" aria-hidden />}
            title="Suporte"
            subtitle="WhatsApp da equipe Origem"
            href={supportHref}
          />
        </div>

        <div style={{ textAlign: "center", marginTop: "6px" }}>
          <button
            type="button"
            className="m-btn m-text"
            style={{ color: "var(--m-danger-700)" }}
            onClick={() => void signOut()}
          >
            <LogOut className="lucide" aria-hidden />
            Sair da conta
          </button>
        </div>
      </div>

      <Sheet open={sheet === "details"} title="Dados da propriedade" onClose={() => setSheet(null)}>
        <div className="m-legacy">
          <ProducerDetailsPanel
            details={details}
            onSave={async (next) => {
              await saveDetails(next);
              toast.success("Dados da propriedade salvos");
            }}
            saving={saving}
            focusProductsOnLoad={editProductsRequested}
          />
        </div>
      </Sheet>
      <Sheet open={sheet === "memberships"} title="Cooperativas" onClose={() => setSheet(null)}>
        <div className="m-legacy">
          <ProducerMemberships />
        </div>
      </Sheet>
      <Sheet open={sheet === "notifications"} title="Notificações" onClose={() => setSheet(null)}>
        <PushSettings />
      </Sheet>
      <Sheet open={sheet === "settings"} title="Ajustes" onClose={() => setSheet(null)}>
        <span className="m-lbl">Tamanho do texto</span>
        <TextSizeOptions />
        <span className="m-lbl">Aplicativo</span>
        <InstallButton variant="compact" />
      </Sheet>
    </>
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

function ProducerDetailsPanel({
  details,
  onSave,
  saving,
  focusProductsOnLoad = false,
}: {
  details: ProducerProfileDetails;
  onSave: (details: ProducerProfileDetails) => Promise<void>;
  saving: boolean;
  focusProductsOnLoad?: boolean;
}) {
  const [editing, setEditing] = useState(focusProductsOnLoad);
  const [draft, setDraft] = useState(details);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [cepStatus, setCepStatus] = useState("");
  const [searchingCep, setSearchingCep] = useState(false);
  const cepRequestRef = useRef<AbortController | null>(null);
  const addressNumberRef = useRef<HTMLInputElement>(null);
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const [focusProductsWhenEditing, setFocusProductsWhenEditing] = useState(focusProductsOnLoad);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(details);
  const missingFields = getMissingProducerProfileFields(details);
  const productsPending = hasMissingProducerProducts(details);

  useEffect(() => {
    setDraft(details);
  }, [details]);

  useEffect(() => () => cepRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!focusProductsOnLoad) return;
    setFocusProductsWhenEditing(true);
    setEditing(true);
  }, [focusProductsOnLoad]);

  useEffect(() => {
    if (!editing || !focusProductsWhenEditing) return;
    productsSectionRef.current?.focus();
    productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusProductsWhenEditing(false);
  }, [editing, focusProductsWhenEditing]);

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

  const openProductsEditor = () => {
    setNotice("");
    setError("");
    setFocusProductsWhenEditing(true);
    setEditing(true);
  };

  return (
    <Panel title="Dados da propriedade" icon={Store}>
      {!editing ? (
        <div>
          {productsPending && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-950"
            >
              <div className="flex items-start gap-3">
                <Package className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Informe seus produtos</p>
                  <p className="mt-1 text-sm">
                    Cadastre o que você produz ou fornece para aparecer nas buscas e receber
                    demandas compatíveis.
                  </p>
                  <button
                    type="button"
                    onClick={openProductsEditor}
                    className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-orange-700 px-4 text-sm font-semibold text-white hover:bg-orange-800"
                  >
                    Cadastrar produtos
                  </button>
                </div>
              </div>
            </div>
          )}
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
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
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
                    className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500 disabled:cursor-wait disabled:opacity-60"
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
          <div ref={productsSectionRef} tabIndex={-1} className="scroll-mt-24 outline-none">
            <FormSection
              title="Produtos atendidos"
              caption={"Informe o que voc\u00ea produz ou fornece."}
            >
              <SupplierProductPicker
                value={draft.products}
                onChange={(products) => setDraft({ ...draft, products })}
                onRequestProduct={requestCatalogProduct}
              />
              <span className="mt-1.5 block text-xs text-muted-foreground">
                Esta lista representa tudo que você fornece. O estoque publicado pode conter apenas
                os produtos disponíveis no momento.
              </span>
            </FormSection>
          </div>
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
              className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf-600 px-4 text-sm font-semibold text-white hover:bg-leaf-700 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
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
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-semibold text-brand-900 hover:border-leaf-500"
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
