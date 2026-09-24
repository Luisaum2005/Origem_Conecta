import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  LifeBuoy,
  LogOut,
  MapPin,
  Pause,
  Play,
  Repeat,
  Settings,
  Store,
  Trash2,
  Wallet,
} from "@/components/mobile/icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { supportHref } from "@/lib/support";
import { ListRow, TextSizeOptions } from "@/components/mobile/ProfileParts";
import { Sheet } from "@/components/mobile/Sheet";
import { PushSettings } from "@/components/notifications/PushSettings";
import { DataLoadError } from "@/components/system/DataLoadState";
import { useAuth } from "@/lib/auth";
import { useAvailableProducts } from "@/lib/available-products";
import { type BuyerProfileDetails, useBuyerProfileDetails } from "@/lib/buyer-profile";
import { useCart } from "@/lib/cart";
import {
  formatCompactBRL,
  initials,
  readPaymentPreference,
  writePaymentPreference,
} from "@/lib/format";
import { PAYMENT_METHODS, useOrders } from "@/lib/orders";
import { useBuyerRatings } from "@/lib/ratings";
import { type RecurringOrder, useRecurringOrders } from "@/lib/recurring-orders";

export const Route = createFileRoute("/profile/buyer")({
  component: () => (
    <RequireProfile allowed={["comprador"]}>
      <BuyerProfile />
    </RequireProfile>
  ),
});

const BUSINESS_TYPES = ["Restaurante", "Mercado", "Hotel", "Hortifruti", "Cozinha industrial"];
type SheetName = "address" | "company" | "payment" | "recurring" | "notifications" | "settings";

function hasAddress(details: BuyerProfileDetails) {
  return (
    details.postalCode.replace(/\D/g, "").length === 8 &&
    Boolean(details.addressLine.trim()) &&
    Boolean(details.neighborhood.trim()) &&
    Boolean(details.city.trim()) &&
    /^[A-Za-z]{2}$/.test(details.state.trim())
  );
}

function BuyerProfile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { details, saveDetails, saving, error, reload } = useBuyerProfileDetails();
  const { orders } = useOrders();
  const { ratings } = useBuyerRatings();
  const { recurringOrders, toggleRecurringOrder, removeRecurringOrder } = useRecurringOrders();
  const products = useAvailableProducts();
  const { replaceCart } = useCart();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [payment, setPayment] = useState("A combinar");

  useEffect(() => {
    setPayment(readPaymentPreference() ?? "A combinar");
    if (window.location.hash === "#endereco") setSheet("address");
  }, []);

  const active = orders.filter((order) => order.status !== "Cancelado");
  const bought = active.reduce((sum, order) => sum + order.total, 0);
  const average = ratings.length
    ? (ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length).toLocaleString(
        "pt-BR",
        { maximumFractionDigits: 1 },
      )
    : "—";
  const addressReady = hasAddress(details);
  const location = [details.city, details.state].filter(Boolean).join(", ");
  const activeRecurring = recurringOrders.filter((order) => order.active);

  const loadRecurring = (order: RecurringOrder) => {
    const available = new Set(products.map((product) => product.id));
    const cart: Record<string, number> = {};
    for (const item of order.items)
      if (available.has(item.productId)) cart[item.productId] = item.quantity;
    if (!Object.keys(cart).length) {
      toast.error("Nenhum item desta lista está disponível no estoque atual.");
      return;
    }
    replaceCart(cart, {});
    toast.success("Lista recorrente carregada para revisão.");
    void navigate({ to: "/order" });
  };

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-11-perfil">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Perfil</h1>
          <button
            type="button"
            className="m-round"
            aria-label="Ajustes"
            onClick={() => setSheet("settings")}
          >
            <Settings className="lucide" aria-hidden />
          </button>
        </div>

        {error && (
          <div className="m-pad">
            <DataLoadError message={error} onRetry={reload} />
          </div>
        )}

        <div className="m-me m-card">
          <span className="m-avatar m-big">
            {initials(details.companyName || profile?.nome) || "?"}
          </span>
          <div>
            <b>{details.companyName || profile?.nome || "Seu estabelecimento"}</b>
            <span>
              {[details.responsibleName || profile?.nome, location].filter(Boolean).join(" · ")}
            </span>
            <span className="m-chip m-leaf" style={{ marginTop: "8px" }}>
              <BadgeCheck className="lucide" aria-hidden />
              Comprador verificado
            </span>
          </div>
        </div>

        <div className="m-kp">
          <div className="m-card">
            <b>{active.length}</b>
            <span>solicitações</span>
          </div>
          <div className="m-card">
            <b>{formatCompactBRL(bought)}</b>
            <span>comprados</span>
          </div>
          <div className="m-card">
            <b>{average}</b>
            <span>nota média</span>
          </div>
        </div>

        <div className="m-grp m-card">
          <ListRow
            icon={<MapPin className="lucide" aria-hidden />}
            title="Endereço de entrega"
            subtitle={
              addressReady
                ? `${details.addressLine}${details.addressNumber ? `, ${details.addressNumber}` : ""} · ${details.neighborhood}`
                : "Pendente — complete para enviar pedidos"
            }
            warn={!addressReady}
            onClick={() => setSheet("address")}
          />
          <ListRow
            icon={<Store className="lucide" aria-hidden />}
            title="Dados do estabelecimento"
            subtitle="CNPJ, tipo e responsável"
            onClick={() => setSheet("company")}
          />
          <ListRow
            icon={<Wallet className="lucide" aria-hidden />}
            title="Pagamento preferido"
            subtitle={payment}
            onClick={() => setSheet("payment")}
          />
          <ListRow
            icon={<Repeat className="lucide" aria-hidden />}
            title="Pedidos recorrentes"
            subtitle={
              recurringOrders.length
                ? `${recurringOrders.length} ${recurringOrders.length === 1 ? "lista salva" : "listas salvas"}${activeRecurring[0]?.preferredDeliveryDay ? ` · ${activeRecurring[0].preferredDeliveryDay}` : ""}`
                : "Nenhuma lista salva"
            }
            onClick={() => setSheet("recurring")}
          />
        </div>

        <div className="m-grp m-card">
          <ListRow
            icon={<Bell className="lucide" aria-hidden />}
            title="Notificações"
            subtitle="Pedidos, mensagens e prazos"
            onClick={() => setSheet("notifications")}
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

      <DetailsSheet
        open={sheet === "address" || sheet === "company"}
        mode={sheet === "address" ? "address" : "company"}
        details={details}
        saving={saving}
        onClose={() => setSheet(null)}
        onSave={async (next) => {
          await saveDetails(next);
          toast.success(sheet === "address" ? "Endereço salvo" : "Dados atualizados");
          setSheet(null);
        }}
      />

      <Sheet open={sheet === "payment"} title="Pagamento preferido" onClose={() => setSheet(null)}>
        <p className="m-note" style={{ marginTop: 0, marginBottom: 14 }}>
          Vem marcado nas suas próximas listas. O pagamento é sempre combinado com o produtor.
        </p>
        <div className="m-opts" role="radiogroup" aria-label="Pagamento preferido">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={payment === method}
              className={`m-pill${payment === method ? " m-sel" : ""}`}
              onClick={() => {
                setPayment(method);
                writePaymentPreference(method);
              }}
            >
              {method}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={sheet === "recurring"}
        title="Pedidos recorrentes"
        onClose={() => setSheet(null)}
      >
        {recurringOrders.length === 0 ? (
          <p className="m-note">
            Salve uma lista de interesse como recorrente (menu “…” da lista) para repetir com um
            toque.
          </p>
        ) : (
          recurringOrders.map((order) => (
            <div key={order.id} className="m-subcard">
              <div className="m-subcard-hd">
                <span>
                  {order.name}
                  <small className="m-sub2">
                    {order.items.length} {order.items.length === 1 ? "item" : "itens"} ·{" "}
                    {order.frequency} · {order.active ? "ativo" : "pausado"}
                  </small>
                </span>
                <button
                  type="button"
                  onClick={() => removeRecurringOrder(order.id)}
                  aria-label={`Excluir ${order.name}`}
                >
                  <Trash2 className="lucide" aria-hidden />
                </button>
              </div>
              <div className="m-opts" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="m-btn m-primary m-sm"
                  onClick={() => loadRecurring(order)}
                >
                  <Repeat className="lucide" aria-hidden />
                  Carregar
                </button>
                <button
                  type="button"
                  className="m-btn m-secondary m-sm"
                  onClick={() => toggleRecurringOrder(order.id)}
                >
                  {order.active ? (
                    <Pause className="lucide" aria-hidden />
                  ) : (
                    <Play className="lucide" aria-hidden />
                  )}
                  {order.active ? "Pausar" : "Ativar"}
                </button>
              </div>
            </div>
          ))
        )}
      </Sheet>

      <Sheet open={sheet === "notifications"} title="Notificações" onClose={() => setSheet(null)}>
        <PushSettings />
      </Sheet>

      <Sheet open={sheet === "settings"} title="Ajustes" onClose={() => setSheet(null)}>
        <span className="m-lbl">Tamanho do texto</span>
        <TextSizeOptions />
      </Sheet>
    </>
  );
}

function DetailsSheet({
  open,
  mode,
  details,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "address" | "company";
  details: BuyerProfileDetails;
  saving: boolean;
  onClose: () => void;
  onSave: (details: BuyerProfileDetails) => Promise<void>;
}) {
  const [draft, setDraft] = useState(details);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setDraft(details);
      setError("");
    }
  }, [details, open]);
  const set = (patch: Partial<BuyerProfileDetails>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const field = (
    label: string,
    key: keyof BuyerProfileDetails,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="m-field">
      <span>{label}</span>
      <div className="m-in">
        <input
          value={draft[key]}
          onChange={(event) => set({ [key]: event.target.value })}
          {...extra}
        />
      </div>
    </label>
  );
  const types = useMemo(
    () =>
      draft.businessType && !BUSINESS_TYPES.includes(draft.businessType)
        ? [...BUSINESS_TYPES, draft.businessType]
        : BUSINESS_TYPES,
    [draft.businessType],
  );

  const save = async () => {
    setError("");
    try {
      await onSave(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  return (
    <Sheet
      open={open}
      title={mode === "address" ? "Endereço de entrega" : "Dados do estabelecimento"}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="m-btn m-primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      }
    >
      {mode === "address" ? (
        <>
          {field("CEP", "postalCode", { inputMode: "numeric", placeholder: "00000-000" })}
          {field("Rua ou avenida", "addressLine")}
          <div className="m-row2">
            {field("Número", "addressNumber", { inputMode: "numeric" })}
            {field("Complemento", "addressComplement", { placeholder: "Opcional" })}
          </div>
          {field("Bairro", "neighborhood")}
          <div className="m-row2">
            {field("Cidade", "city")}
            {field("UF", "state", { maxLength: 2, placeholder: "PI" })}
          </div>
          <p className="m-note">Só os produtores do seu pedido veem este endereço.</p>
        </>
      ) : (
        <>
          {field("Nome do estabelecimento", "companyName")}
          <div className="m-field">
            <span>Tipo</span>
            <div className="m-pills">
              {types.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={draft.businessType === type}
                  className={`m-pill${draft.businessType === type ? " m-on" : ""}`}
                  onClick={() => set({ businessType: type })}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          {field("CNPJ", "cnpj", { inputMode: "numeric", placeholder: "00.000.000/0000-00" })}
          {field("Responsável pelas compras", "responsibleName", { placeholder: "Nome completo" })}
          {field("Telefone / WhatsApp", "phone", {
            inputMode: "tel",
            placeholder: "(86) 90000-0000",
          })}
        </>
      )}
      {error && (
        <p className="m-field">
          <small className="m-err">{error}</small>
        </p>
      )}
    </Sheet>
  );
}
