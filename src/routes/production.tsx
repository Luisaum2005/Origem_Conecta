import { createFileRoute, Link } from "@tanstack/react-router";
import {
  EllipsisVertical,
  Eye,
  EyeOff,
  ImagePlus,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "@/components/mobile/icons";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { ProductFallback } from "@/components/marketplace/ProductCard";
import { MoreMenu, Sheet } from "@/components/mobile/Sheet";
import { DataLoadError, DataLoading } from "@/components/system/DataLoadState";
import { formatBRL, formatCompactBRL, unitLabel } from "@/lib/format";
import { ALL_SUPPLIER_PRODUCTS } from "@/lib/hortifruti";
import {
  EMPTY_STOCK_ITEM,
  type ProducerStockItem,
  type SalesOrganization,
  useProducerStock,
} from "@/lib/producer-stock";
import { productGroup } from "@/lib/product-group";

export const Route = createFileRoute("/production")({
  component: () => (
    <RequireProfile allowed={["produtor"]}>
      <Production />
    </RequireProfile>
  ),
});

const UNITS = ["kg", "unidade", "caixa", "pacote", "pote", "litro", "maço", "dúzia", "bandeja"];
type Filter = "all" | "active" | "paused" | "low";
const CHIP_STYLE = { height: "22px", fontSize: "11px", padding: "0 8px" };

const isLow = (item: ProducerStockItem) =>
  Number(item.minimumStock || 0) > 0 && Number(item.quantity || 0) <= Number(item.minimumStock);

function organizationOptionLabel(organization: SalesOrganization) {
  if (organization.membershipStatus === "invited") return "convite aguardando aceite";
  if (organization.membershipStatus === "pending") return "vínculo aguardando aprovação";
  if (organization.organizationStatus !== "active") return "organização indisponível";
  if (!organization.canSell) return "aguardando autorização comercial";
  return `CNPJ ${organization.cnpj}`;
}

function Production() {
  const [
    items,
    setItems,
    {
      uploadImage,
      uploadVideo,
      deleteItem,
      salesOrganizations,
      loading,
      error,
      reload,
      deletingItemIds,
    },
  ] = useProducerStock();
  const [filter, setFilter] = useState<Filter>("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ProducerStockItem | null>(null);
  const [removing, setRemoving] = useState<ProducerStockItem | null>(null);

  const active = items.filter((item) => item.status === "ativo");
  const paused = items.filter((item) => item.status === "pausado");
  const low = items.filter(isLow);
  const potential = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
    0,
  );
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (term && !item.product.toLowerCase().includes(term)) return false;
      if (filter === "active") return item.status === "ativo";
      if (filter === "paused") return item.status === "pausado";
      if (filter === "low") return isLow(item);
      return true;
    });
  }, [filter, items, query]);

  const toggleStatus = (item: ProducerStockItem) => {
    const next = item.status === "ativo" ? "pausado" : "ativo";
    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, status: next } : row)),
    );
    toast.success(
      next === "ativo" ? `${item.product} voltou ao portfólio` : `${item.product} pausado`,
    );
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await deleteItem(removing.id);
      toast.success(`${removing.product} excluído`);
      setRemoving(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir o produto.");
    }
  };

  const pills: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "paused", label: "Pausados", count: paused.length },
    { key: "low", label: "Acabando", count: low.length },
  ];

  return (
    <>
      <Navbar />
      <div className="m-screen m-s-p2-estoque">
        <div className="m-status" />
        <div className="m-hd m-big">
          <h1>Estoque</h1>
          <button
            type="button"
            className="m-round"
            aria-label={searching ? "Fechar busca" : "Buscar no estoque"}
            onClick={() => {
              setSearching((current) => !current);
              setQuery("");
            }}
          >
            {searching ? (
              <X className="lucide" aria-hidden />
            ) : (
              <Search className="lucide" aria-hidden />
            )}
          </button>
        </div>
        {searching && (
          <div style={{ padding: "14px 20px 0" }}>
            <label className="m-search">
              <Search className="lucide" aria-hidden />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produto"
                aria-label="Buscar produto no estoque"
              />
            </label>
          </div>
        )}

        <div className="m-kpi">
          <div className="m-card">
            <span>Ativos no portfólio</span>
            <b>
              {active.length} de {items.length}
            </b>
          </div>
          <div className="m-card">
            <span>Potencial em estoque</span>
            <b>{formatCompactBRL(potential)}</b>
          </div>
        </div>

        <div className="m-cats" role="tablist">
          {pills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              role="tab"
              aria-selected={filter === pill.key}
              className={`m-pill${filter === pill.key ? " m-on" : ""}`}
              onClick={() => setFilter(pill.key)}
            >
              {pill.label}
              {pill.count ? <span className="m-n">{pill.count}</span> : null}
            </button>
          ))}
        </div>

        {error && (
          <div className="m-pad">
            <DataLoadError message={error} onRetry={reload} />
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="m-pad">
            <DataLoading label="Carregando seu estoque..." />
          </div>
        ) : visible.length === 0 ? (
          <div className="m-pad">
            <div className="m-card m-empty">
              <b>{items.length ? "Nada neste filtro" : "Nenhum produto cadastrado"}</b>
              <span>
                {items.length
                  ? "Escolha outro filtro ou busca."
                  : "Toque em “Novo produto” para aparecer no portfólio dos compradores."}
              </span>
            </div>
          </div>
        ) : (
          <div className="m-list">
            {visible.map((item) => {
              const quantity = Number(item.quantity || 0);
              return (
                <div
                  key={item.id}
                  className={`m-sk m-card${item.status === "pausado" ? " m-paused" : ""}`}
                  aria-busy={deletingItemIds.has(item.id) || undefined}
                >
                  {item.imageUrl ? (
                    <div className="m-ph">
                      <img src={item.imageUrl} alt={item.product} />
                    </div>
                  ) : (
                    <div className="m-ph">
                      <ProductFallback
                        category={productGroup(item.product)}
                        name={item.product}
                        label={false}
                        className="m-fill"
                      />
                    </div>
                  )}
                  <div className="m-tx">
                    <div className="m-r1">
                      <b>{item.product}</b>
                      <span
                        className={`m-chip ${item.status === "ativo" ? "m-st-entregue" : "m-st-recebido"}`}
                        style={CHIP_STYLE}
                      >
                        {item.status === "ativo" ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                    <span className="m-muted">
                      {quantity.toLocaleString("pt-BR")} {unitLabel(item.unit, quantity)}{" "}
                      disponíveis
                      {item.sellerOrganizationName ? ` · pela ${item.sellerOrganizationName}` : ""}
                    </span>
                    <div className="m-r2">
                      <span className="m-price">
                        {formatBRL(Number(item.price || 0))} <small>/{item.unit}</small>
                      </span>
                      {isLow(item) && (
                        <span className="m-warn">
                          <TriangleAlert className="lucide" aria-hidden />
                          Abaixo do mínimo
                        </span>
                      )}
                    </div>
                  </div>
                  <MoreMenu
                    label={`Opções de ${item.product}`}
                    buttonClassName="m-more"
                    icon={<EllipsisVertical className="lucide" aria-hidden />}
                    items={[
                      {
                        label: "Editar",
                        icon: <Pencil className="lucide" aria-hidden />,
                        onSelect: () => setEditing(item),
                      },
                      {
                        label: item.status === "ativo" ? "Pausar" : "Ativar",
                        icon:
                          item.status === "ativo" ? (
                            <EyeOff className="lucide" aria-hidden />
                          ) : (
                            <Eye className="lucide" aria-hidden />
                          ),
                        onSelect: () => toggleStatus(item),
                      },
                      {
                        label: "Excluir",
                        icon: <Trash2 className="lucide" aria-hidden />,
                        danger: true,
                        onSelect: () => setRemoving(item),
                      },
                    ]}
                  />
                </div>
              );
            })}
          </div>
        )}

        <button type="button" className="m-fab" onClick={() => setEditing(EMPTY_STOCK_ITEM)}>
          <Plus className="lucide" aria-hidden />
          Novo produto
        </button>
      </div>

      <StockSheet
        item={editing}
        onClose={() => setEditing(null)}
        salesOrganizations={salesOrganizations}
        uploadImage={uploadImage}
        uploadVideo={uploadVideo}
        onSave={(draft) => {
          const exists = items.some((item) => item.id === draft.id);
          setItems((current) =>
            exists
              ? current.map((item) => (item.id === draft.id ? draft : item))
              : [{ ...draft, id: draft.id || crypto.randomUUID() }, ...current],
          );
          toast.success(exists ? "Produto atualizado" : "Produto adicionado ao estoque");
          setEditing(null);
        }}
      />

      <Sheet
        open={Boolean(removing)}
        title={`Excluir ${removing?.product ?? ""}?`}
        onClose={() => setRemoving(null)}
        footer={
          <button
            type="button"
            className="m-btn m-primary m-danger-btn"
            disabled={removing ? deletingItemIds.has(removing.id) : false}
            onClick={() => void confirmRemove()}
          >
            <Trash2 className="lucide" aria-hidden />
            Excluir produto
          </button>
        }
      >
        <p className="m-note">
          O produto sai do portfólio e não dá para desfazer. Se for só uma pausa, use “Pausar”.
        </p>
      </Sheet>
    </>
  );
}

function StockSheet({
  item,
  onClose,
  onSave,
  salesOrganizations,
  uploadImage,
  uploadVideo,
}: {
  item: ProducerStockItem | null;
  onClose: () => void;
  onSave: (item: ProducerStockItem) => void;
  salesOrganizations: SalesOrganization[];
  uploadImage: (file: File, itemId: string) => Promise<string>;
  uploadVideo: (file: File, itemId: string) => Promise<string>;
}) {
  const [draft, setDraft] = useState<ProducerStockItem>(EMPTY_STOCK_ITEM);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [error, setError] = useState("");
  const [lastItem, setLastItem] = useState<ProducerStockItem | null>(null);
  if (item !== lastItem) {
    setLastItem(item);
    setDraft(item ?? EMPTY_STOCK_ITEM);
    setError("");
  }
  const authorized = salesOrganizations.filter(
    (organization) =>
      organization.membershipStatus === "active" &&
      organization.canSell &&
      organization.organizationStatus === "active",
  );
  const set = (patch: Partial<ProducerStockItem>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const valid = draft.product && draft.quantity && draft.unit && draft.price;

  const upload = async (kind: "image" | "video", file?: File) => {
    if (!file) return;
    setError("");
    setUploading(kind);
    try {
      const itemId = draft.id || crypto.randomUUID();
      const url =
        kind === "image" ? await uploadImage(file, itemId) : await uploadVideo(file, itemId);
      set(kind === "image" ? { id: itemId, imageUrl: url } : { id: itemId, videoUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o arquivo.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <Sheet
      open={Boolean(item)}
      title={item?.id ? "Editar produto" : "Novo produto"}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="m-btn m-primary"
          disabled={!valid}
          onClick={() => onSave(draft)}
        >
          {item?.id ? "Salvar alterações" : "Adicionar ao estoque"}
        </button>
      }
    >
      <label className="m-field">
        <span>Produto</span>
        <div className="m-in">
          <input
            list="supplier-products"
            value={draft.product}
            onChange={(event) => set({ product: event.target.value })}
            placeholder="Digite ou escolha"
          />
        </div>
        <datalist id="supplier-products">
          {ALL_SUPPLIER_PRODUCTS.map((product) => (
            <option key={product} value={product} />
          ))}
        </datalist>
      </label>

      <div className="m-field">
        <span>Foto</span>
        <div className="m-media">
          {draft.imageUrl ? (
            <img src={draft.imageUrl} alt="Foto do produto" />
          ) : (
            <div className="m-fallback">
              <ImagePlus className="lucide" aria-hidden />
              <span>JPG, PNG ou WebP até 5 MB</span>
            </div>
          )}
          <div className="m-media-acts">
            <label className="m-btn m-secondary m-sm">
              <ImagePlus className="lucide" aria-hidden />
              {uploading === "image"
                ? "Carregando..."
                : draft.imageUrl
                  ? "Trocar foto"
                  : "Enviar foto"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={Boolean(uploading)}
                onChange={(event) => void upload("image", event.target.files?.[0])}
              />
            </label>
            {draft.imageUrl && (
              <button
                type="button"
                className="m-btn m-text m-sm"
                onClick={() => set({ imageUrl: undefined })}
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="m-field">
        <span>Vídeo curto (opcional)</span>
        <div className="m-media-acts">
          <label className="m-btn m-secondary m-sm">
            <PlayCircle className="lucide" aria-hidden />
            {uploading === "video"
              ? "Carregando..."
              : draft.videoUrl
                ? "Trocar vídeo"
                : "Enviar vídeo"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="sr-only"
              disabled={Boolean(uploading)}
              onChange={(event) => void upload("video", event.target.files?.[0])}
            />
          </label>
          {draft.videoUrl && (
            <button
              type="button"
              className="m-btn m-text m-sm"
              onClick={() => set({ videoUrl: undefined })}
            >
              Remover vídeo
            </button>
          )}
        </div>
      </div>

      <div className="m-row2">
        <label className="m-field">
          <span>Quantidade</span>
          <div className="m-in">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.quantity}
              onChange={(event) => set({ quantity: event.target.value })}
              placeholder="120"
            />
          </div>
        </label>
        <label className="m-field">
          <span>Unidade</span>
          <div className="m-in">
            <select value={draft.unit} onChange={(event) => set({ unit: event.target.value })}>
              {UNITS.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </label>
      </div>
      <div className="m-row2">
        <label className="m-field">
          <span>Preço por {draft.unit || "unidade"}</span>
          <div className="m-in">
            <span className="m-end" style={{ marginLeft: 0 }}>
              R$
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.price}
              onChange={(event) => set({ price: event.target.value })}
              placeholder="0,00"
            />
          </div>
        </label>
        <label className="m-field">
          <span>Avisar quando restar</span>
          <div className="m-in">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.minimumStock}
              onChange={(event) => set({ minimumStock: event.target.value })}
              placeholder="Opcional"
            />
          </div>
        </label>
      </div>
      <div className="m-row2">
        <label className="m-field">
          <span>Colheita</span>
          <div className="m-in">
            <input
              type="date"
              value={draft.harvestDate}
              onChange={(event) => set({ harvestDate: event.target.value })}
            />
          </div>
        </label>
        <label className="m-field">
          <span>Validade</span>
          <div className="m-in">
            <input
              type="date"
              value={draft.expiryDate}
              onChange={(event) => set({ expiryDate: event.target.value })}
            />
          </div>
        </label>
      </div>

      <label className="m-field">
        <span>Quem vende</span>
        <div className="m-in">
          <select
            value={draft.sellerOrganizationId ?? ""}
            onChange={(event) => {
              const organization = authorized.find((row) => row.id === event.target.value);
              set({
                sellerOrganizationId: organization?.id,
                sellerOrganizationName: organization?.name,
                sellerOrganizationCnpj: organization?.cnpj,
              });
            }}
          >
            <option value="">Eu mesmo (venda própria)</option>
            {salesOrganizations.map((organization) => (
              <option
                key={organization.id}
                value={organization.id}
                disabled={!authorized.includes(organization)}
              >
                {organization.name} — {organizationOptionLabel(organization)}
              </option>
            ))}
          </select>
        </div>
        {salesOrganizations.length === 0 && (
          <small>
            Sem cooperativa vinculada. Peça o vínculo no seu{" "}
            <Link to="/profile/producer">perfil</Link>.
          </small>
        )}
      </label>

      <label className="m-field">
        <span>Observações</span>
        <textarea
          className="m-textarea"
          rows={3}
          value={draft.notes}
          onChange={(event) => set({ notes: event.target.value })}
          placeholder="Lote colhido hoje, embalagem de 500 g, entrega só terça..."
        />
      </label>

      <div className="m-field m-toggle">
        <span>
          Produto ativo
          <small>Pausados ficam fora do portfólio.</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={draft.status === "ativo"}
          className={`m-sw${draft.status === "ativo" ? " m-on" : ""}`}
          onClick={() => set({ status: draft.status === "ativo" ? "pausado" : "ativo" })}
        >
          <i />
        </button>
      </div>
      {error && (
        <p className="m-field">
          <small className="m-err">{error}</small>
        </p>
      )}
    </Sheet>
  );
}
