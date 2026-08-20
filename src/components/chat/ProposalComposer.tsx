import {
  type DeliveryMethod,
  type NegotiationProposal,
  type ProposalDraft,
  type ProposalInventoryItem,
} from "@/lib/negotiation-proposals";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DraftItem = { inventoryId: string; quantity: string; unitPrice: string };

function defaultExpiration(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ProposalComposer({
  open,
  onOpenChange,
  inventory,
  initialProposal,
  preferredInventoryId,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: ProposalInventoryItem[];
  initialProposal?: NegotiationProposal;
  preferredInventoryId?: string;
  submitting: boolean;
  onSubmit: (draft: ProposalDraft) => Promise<void>;
}) {
  const preferred = useMemo(
    () => inventory.find((item) => item.inventoryId === preferredInventoryId) ?? inventory[0],
    [inventory, preferredInventoryId],
  );
  const [items, setItems] = useState<DraftItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("A combinar");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("A combinar");
  const [deliveryAt, setDeliveryAt] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState("7");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPaymentMethod(initialProposal?.paymentMethod ?? "A combinar");
    setDeliveryMethod(initialProposal?.deliveryMethod ?? "A combinar");
    setDeliveryAt(toDateTimeLocal(initialProposal?.deliveryAt));
    setDeliveryNotes(initialProposal?.deliveryNotes ?? "");
    setNotes(initialProposal?.notes ?? "");
    setValidityDays("7");
    setError("");
    setItems(
      initialProposal?.items.length
        ? initialProposal.items.map((item) => ({
            inventoryId: item.inventoryId,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          }))
        : preferred
          ? [
              {
                inventoryId: preferred.inventoryId,
                quantity: "1",
                unitPrice: String(preferred.announcedPrice),
              },
            ]
          : [],
    );
  }, [initialProposal, open, preferred]);

  const selectedIds = new Set(items.map((item) => item.inventoryId));
  const total = items.reduce((sum, item) => {
    const quantity = Number(item.quantity.replace(",", "."));
    const price = Number(item.unitPrice.replace(",", "."));
    return sum + (Number.isFinite(quantity * price) ? quantity * price : 0);
  }, 0);

  const updateItem = (index: number, changes: Partial<DraftItem>) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)),
    );
  };

  const chooseInventory = (index: number, inventoryId: string) => {
    const selected = inventory.find((item) => item.inventoryId === inventoryId);
    updateItem(index, {
      inventoryId,
      unitPrice: selected ? String(selected.announcedPrice) : "",
    });
  };

  const submit = async () => {
    setError("");
    if (!items.length) {
      setError("Inclua pelo menos um produto.");
      return;
    }
    const normalizedItems = items.map((item) => ({
      inventoryId: item.inventoryId,
      quantity: Number(item.quantity.replace(",", ".")),
      unitPrice: Number(item.unitPrice.replace(",", ".")),
    }));
    for (const item of normalizedItems) {
      const stock = inventory.find((available) => available.inventoryId === item.inventoryId);
      if (!stock || item.quantity <= 0 || item.unitPrice <= 0) {
        setError("Confira o produto, a quantidade e o preço.");
        return;
      }
      if (item.quantity > stock.availableQuantity) {
        setError(`A quantidade de ${stock.productName} ultrapassa o estoque disponível.`);
        return;
      }
    }
    if (deliveryAt && new Date(deliveryAt).getTime() <= Date.now()) {
      setError("Informe uma data futura para a entrega ou retirada.");
      return;
    }
    try {
      await onSubmit({
        paymentMethod,
        deliveryMethod,
        deliveryAt: deliveryAt ? new Date(deliveryAt).toISOString() : undefined,
        deliveryNotes: deliveryNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        expiresAt: defaultExpiration(Number(validityDays)),
        items: normalizedItems,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Não foi possível enviar a proposta.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialProposal ? "Fazer contraproposta" : "Criar proposta"}</DialogTitle>
          <DialogDescription>
            Confira os dados. Quem enviar já concorda com esta proposta; o pedido será criado quando
            a outra parte aceitar.
          </DialogDescription>
        </DialogHeader>

        {inventory.length === 0 ? (
          <p className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
            Este produtor não possui produtos disponíveis no estoque para criar uma proposta.
          </p>
        ) : (
          <div className="space-y-5">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-brand-900">Produtos negociados</legend>
              {items.map((item, index) => {
                const selected = inventory.find(
                  (available) => available.inventoryId === item.inventoryId,
                );
                return (
                  <div
                    key={`${item.inventoryId}-${index}`}
                    className="rounded-xl border border-border bg-canvas p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-[1fr_110px_120px_auto] sm:items-end">
                      <label className="text-sm font-medium text-brand-900">
                        Produto
                        <select
                          value={item.inventoryId}
                          onChange={(event) => chooseInventory(index, event.target.value)}
                          className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3"
                        >
                          {inventory.map((available) => (
                            <option
                              key={available.inventoryId}
                              value={available.inventoryId}
                              disabled={
                                available.inventoryId !== item.inventoryId &&
                                selectedIds.has(available.inventoryId)
                              }
                            >
                              {available.productName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-medium text-brand-900">
                        Quantidade
                        <input
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(event) => updateItem(index, { quantity: event.target.value })}
                          className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3"
                        />
                      </label>
                      <label className="text-sm font-medium text-brand-900">
                        Preço/{selected?.unit ?? "un."}
                        <input
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(event) => updateItem(index, { unitPrice: event.target.value })}
                          className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                        disabled={items.length === 1}
                        className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-white text-red-700 disabled:opacity-40"
                        aria-label={`Remover ${selected?.productName ?? "produto"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {selected && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Disponível: {selected.availableQuantity.toLocaleString("pt-BR")}{" "}
                        {selected.unit}
                        {selected.sellerOrganizationName
                          ? ` · Comercializado por ${selected.sellerOrganizationName}`
                          : ""}
                      </p>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const next = inventory.find((item) => !selectedIds.has(item.inventoryId));
                  if (next) {
                    setItems((current) => [
                      ...current,
                      {
                        inventoryId: next.inventoryId,
                        quantity: "1",
                        unitPrice: String(next.announcedPrice),
                      },
                    ]);
                  }
                }}
                disabled={items.length >= inventory.length}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-brand-900 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Adicionar produto
              </button>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-brand-900">
                Forma de pagamento
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-brand-900">
                Entrega ou retirada
                <select
                  value={deliveryMethod}
                  onChange={(event) => setDeliveryMethod(event.target.value as DeliveryMethod)}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3"
                >
                  {(["Entrega", "Retirada", "A combinar"] as DeliveryMethod[]).map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-brand-900">
                Data e hora combinada (opcional)
                <input
                  type="datetime-local"
                  value={deliveryAt}
                  onChange={(event) => setDeliveryAt(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3"
                />
              </label>
              <label className="text-sm font-medium text-brand-900">
                Validade da proposta
                <select
                  value={validityDays}
                  onChange={(event) => setValidityDays(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3"
                >
                  <option value="1">1 dia</option>
                  <option value="3">3 dias</option>
                  <option value="7">7 dias</option>
                  <option value="15">15 dias</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium text-brand-900">
              Detalhes da entrega ou retirada
              <input
                value={deliveryNotes}
                onChange={(event) => setDeliveryNotes(event.target.value.slice(0, 500))}
                placeholder="Ex.: entrega pela manhã; frete a combinar"
                className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3"
              />
            </label>
            <label className="block text-sm font-medium text-brand-900">
              Observações
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-white p-3"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-leaf-50 p-4">
              <span className="text-sm font-semibold text-brand-900">Total da proposta</span>
              <strong className="text-xl text-brand-900">R$ {total.toFixed(2)}</strong>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800"
              >
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-11 rounded-xl border border-border px-4 font-semibold text-brand-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || inventory.length === 0}
                className="h-11 rounded-xl bg-brand-900 px-5 font-semibold text-white disabled:opacity-50"
              >
                {submitting
                  ? "Enviando..."
                  : initialProposal
                    ? "Enviar contraproposta"
                    : "Enviar proposta"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
