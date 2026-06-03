import { createFileRoute } from "@tanstack/react-router";
import { RequireProfile } from "@/components/auth/RequireProfile";
import { Navbar } from "@/components/layout/Navbar";
import { InstallButton } from "@/components/pwa/InstallButton";
import { ALL_SUPPLIER_PRODUCTS } from "@/lib/hortifruti";
import { EMPTY_STOCK_ITEM, type ProducerStockItem, useProducerStock } from "@/lib/producer-stock";
import {
  CalendarDays,
  Check,
  CircleDollarSign,
  Eye,
  EyeOff,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Sprout,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/production")({
  component: () => (
    <RequireProfile allowed={["produtor"]}>
      <Production />
    </RequireProfile>
  ),
});

const UNITS = ["kg", "unidade", "caixa", "pacote", "pote", "litro", "maço"];

function Production() {
  const [items, setItems, { uploadImage }] = useProducerStock();
  const [draft, setDraft] = useState<ProducerStockItem>(EMPTY_STOCK_ITEM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  const isValid = draft.product && draft.quantity && draft.unit && draft.price;
  const activeItems = items.filter((item) => item.status === "ativo");
  const totalPotential = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
    0,
  );

  const save = () => {
    if (!isValid) return;
    if (editingId) {
      setItems((current) =>
        current.map((item) => (item.id === editingId ? { ...draft, id: editingId } : item)),
      );
      setEditingId(null);
    } else {
      setItems((current) => [{ ...draft, id: draft.id || crypto.randomUUID() }, ...current]);
    }
    setDraft(EMPTY_STOCK_ITEM);
    setImageError("");
  };

  const edit = (item: ProducerStockItem) => {
    setDraft(item);
    setEditingId(item.id);
  };

  const cancelEdit = () => {
    setDraft(EMPTY_STOCK_ITEM);
    setEditingId(null);
    setImageError("");
  };

  const remove = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
  };

  const toggleStatus = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: item.status === "ativo" ? "pausado" : "ativo" } : item,
      ),
    );
  };

  const handleImageChange = async (file?: File) => {
    if (!file) return;
    setImageError("");
    setUploadingImage(true);
    try {
      const itemId = draft.id || editingId || crypto.randomUUID();
      const imageUrl = await uploadImage(file, itemId);
      setDraft((current) => ({ ...current, id: itemId, imageUrl }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Não foi possível carregar a foto.");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-8 pb-20 sm:px-8 sm:py-10 md:pb-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-leaf-700">
              Painel do produtor
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-900">
              Estoque e disponibilidade
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Cadastre, edite, pause ou remova produtos que você pode fornecer no próximo ciclo.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <InstallButton variant="compact" />
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric icon={Package} label="Produtos cadastrados" value={`${items.length}`} />
          <Metric icon={Sprout} label="Ativos no portfólio" value={`${activeItems.length}`} />
          <Metric
            icon={CircleDollarSign}
            label="Potencial do estoque"
            value={`R$ ${totalPotential.toFixed(2)}`}
          />
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
          <section>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-border bg-canvas p-10 text-center">
                <Sprout className="mx-auto h-10 w-10 text-leaf-600" />
                <h3 className="mt-4 text-lg font-semibold text-brand-900">
                  Nenhum produto cadastrado
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Adicione o primeiro produto usando o formulário ao lado.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3">
                {items.map((item) => (
                  <StockRow
                    key={item.id}
                    item={item}
                    onEdit={() => edit(item)}
                    onDelete={() => remove(item.id)}
                    onToggleStatus={() => toggleStatus(item.id)}
                    editing={editingId === item.id}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:sticky lg:top-[88px] lg:h-fit">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-900">
                {editingId ? "Editar produto" : "Adicionar produto"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand-900"
                >
                  <X className="h-4 w-4" /> Cancelar
                </button>
              )}
            </div>

            <div className="mt-5 space-y-5">
              <ProductSelect
                value={draft.product}
                onChange={(value) => setDraft({ ...draft, product: value })}
              />
              <PhotoField
                imageUrl={draft.imageUrl}
                uploading={uploadingImage}
                error={imageError}
                onChange={handleImageChange}
                onRemove={() => setDraft({ ...draft, imageUrl: undefined })}
              />
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <NumberField
                  label="Quantidade"
                  value={draft.quantity}
                  onChange={(value) => setDraft({ ...draft, quantity: value })}
                  placeholder="120"
                />
                <UnitSelect
                  value={draft.unit}
                  onChange={(value) => setDraft({ ...draft, unit: value })}
                />
              </div>
              <NumberField
                label="Preço por unidade"
                value={draft.price}
                onChange={(value) => setDraft({ ...draft, price: value })}
                placeholder="18.50"
                prefix="R$"
              />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <DateField
                  label="Data de colheita"
                  value={draft.harvestDate}
                  onChange={(value) => setDraft({ ...draft, harvestDate: value })}
                />
                <DateField
                  label="Validade"
                  value={draft.expiryDate}
                  onChange={(value) => setDraft({ ...draft, expiryDate: value })}
                />
              </div>
              <label className="block">
                <span className="block text-sm font-medium text-brand-900">Observações</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="Ex: lote colhido hoje, embalagem de 500g, entrega apenas terça..."
                  className="mt-2 min-h-[92px] w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-brand-900 placeholder:text-[var(--text-tertiary)] focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-border bg-canvas px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-brand-900">Produto ativo</span>
                  <span className="block text-xs text-muted-foreground">
                    Produtos pausados ficam fora da venda.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.status === "ativo"}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.checked ? "ativo" : "pausado" })
                  }
                  className="h-5 w-5 accent-[var(--color-brand-900)]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={!isValid}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-leaf-600 px-5 text-sm font-semibold text-white hover:bg-leaf-700 disabled:bg-[var(--color-surface-disabled)] disabled:text-[var(--text-disabled)]"
            >
              {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Salvar alterações" : "Adicionar ao estoque"}
            </button>
          </section>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-white p-5 shadow-xs">
          <p className="font-semibold text-brand-900">Disponibilidade publicada automaticamente</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Produtos salvos como ativos aparecem no portfólio dos compradores. Para tirar um item da
            venda, use a opção Pausar no estoque.
          </p>
        </div>
      </main>
    </div>
  );
}

function ProductSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? ALL_SUPPLIER_PRODUCTS.filter((item) => item.toLowerCase().includes(q))
      : ALL_SUPPLIER_PRODUCTS;
  }, [query]);

  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">
        Produto <span className="ml-1 text-orange-600">*</span>
      </span>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-white px-3">
        <Package className="h-4 w-4 text-leaf-600" />
        <input
          list="supplier-products"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery(event.target.value);
          }}
          placeholder="Digite ou selecione..."
          className="h-[48px] w-full bg-transparent text-base text-brand-900 placeholder:text-[var(--text-tertiary)] focus:outline-none"
        />
      </div>
      <datalist id="supplier-products">
        {filtered.map((product) => (
          <option key={product} value={product} />
        ))}
      </datalist>
    </label>
  );
}

function PhotoField({
  imageUrl,
  uploading,
  error,
  onChange,
  onRemove,
}: {
  imageUrl?: string;
  uploading: boolean;
  error: string;
  onChange: (file?: File) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <span className="block text-sm font-medium text-brand-900">Foto do produto</span>
      <div className="mt-2 overflow-hidden rounded-xl border border-border bg-canvas">
        {imageUrl ? (
          <img src={imageUrl} alt="Foto do produto" className="h-44 w-full object-cover" />
        ) : (
          <div className="grid h-44 place-items-center bg-[var(--color-surface-brand-soft)] text-center">
            <div>
              <ImagePlus className="mx-auto h-8 w-8 text-leaf-700" />
              <p className="mt-2 text-sm font-semibold text-brand-900">Adicionar foto</p>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou WebP ate 5 MB</p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-white p-3">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500">
            <ImagePlus className="h-4 w-4 text-leaf-700" />
            {uploading ? "Carregando..." : imageUrl ? "Trocar foto" : "Selecionar foto"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => onChange(event.target.files?.[0])}
            />
          </label>
          {imageUrl && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-brand-900"
            >
              Remover
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-[var(--color-error-fg)]">{error}</p>}
    </div>
  );
}

function UnitSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">
        Unidade <span className="ml-1 text-orange-600">*</span>
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-[52px] w-full rounded-xl border border-border bg-white px-3 text-base text-brand-900 focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-100"
      >
        {UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">
        {label} <span className="ml-1 text-orange-600">*</span>
      </span>
      <div className="mt-2 flex h-[52px] items-center rounded-xl border border-border bg-white px-4 focus-within:border-leaf-600 focus-within:ring-2 focus-within:ring-leaf-100">
        {prefix && (
          <span className="mr-2 text-sm font-semibold text-muted-foreground">{prefix}</span>
        )}
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-full w-full bg-transparent text-base text-brand-900 placeholder:text-[var(--text-tertiary)] focus:outline-none"
        />
      </div>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-900">{label}</span>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-white px-3">
        <CalendarDays className="h-4 w-4 text-leaf-600" />
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-[48px] w-full bg-transparent text-base text-brand-900 focus:outline-none"
        />
      </div>
    </label>
  );
}

function StockRow({
  item,
  onEdit,
  onDelete,
  onToggleStatus,
  editing,
}: {
  item: ProducerStockItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  editing: boolean;
}) {
  const fmt = (date: string) => {
    if (!date) return "sem data";
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  };
  const total = Number(item.quantity || 0) * Number(item.price || 0);

  return (
    <li
      className={`rounded-2xl border bg-white p-4 shadow-xs ${
        editing ? "border-leaf-600 ring-2 ring-leaf-100" : "border-border"
      } ${item.status === "pausado" ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.product}
            className="h-24 w-28 rounded-xl object-cover"
          />
        ) : (
          <div className="grid h-24 w-28 place-items-center rounded-xl bg-[var(--color-surface-brand-soft)] text-leaf-700">
            <Package className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-brand-900">{item.product}</p>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                item.status === "ativo"
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {item.status === "ativo" ? "ativo" : "pausado"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.quantity || "0"} {item.unit} · R$ {Number(item.price || 0).toFixed(2)}/{item.unit}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Colheita {fmt(item.harvestDate)} · Validade {fmt(item.expiryDate)}
          </p>
          {item.notes && <p className="mt-2 text-sm text-brand-900">{item.notes}</p>}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Potencial
          </p>
          <p className="text-lg font-bold text-brand-900">R$ {total.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onToggleStatus}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
        >
          {item.status === "ativo" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {item.status === "ativo" ? "Pausar" : "Ativar"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-900 hover:border-leaf-500"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-error-bg)] bg-white px-3 text-sm font-semibold text-[var(--color-error-fg)] hover:bg-[var(--color-error-bg)]"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      </div>
    </li>
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
