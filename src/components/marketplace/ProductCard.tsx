import { Apple, Carrot, Egg, Leaf, Minus, Package, Plus, Sprout } from "@/components/mobile/icons";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { preferredProducer, type Product } from "@/lib/catalog";
import { formatBRL, formatQuantity, unitLabel } from "@/lib/format";

function parseQuantity(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampQuantity(value: number, max: number) {
  return Math.max(0, Math.min(max, Number(value.toFixed(2))));
}

function categoryIcon(category: string, productName: string) {
  const name = `${category} ${productName}`.toLowerCase();
  return /folh|verdura|alface|cheiro|couve|rúcula|salsa/.test(name)
    ? Leaf
    : /legum|hortali|cenoura|abóbora|tomate|pepino/.test(name)
      ? Carrot
      : /frut|banana|laranja|manga|mamão/.test(name)
        ? Apple
        : /raiz|raíz|tubér|mandioca|macaxeira|batata/.test(name)
          ? Sprout
          : /ovo/.test(name)
            ? Egg
            : Package;
}

/** Ícone da categoria usado quando o produtor ainda não enviou foto. */
export function CategoryIcon({ category, name }: { category: string; name: string }) {
  const Icon = categoryIcon(category, name);
  return <Icon className="lucide" aria-hidden />;
}

/** "Foto padrão" do Figma: degradê verde-claro, ícone da categoria e o nome do grupo. */
export function ProductFallback({
  category,
  name,
  className = "",
  label = true,
  children,
}: {
  category: string;
  name: string;
  className?: string;
  label?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`m-fallback ${className}`}>
      <CategoryIcon category={category} name={name} />
      {label && <span>{category}</span>}
      {children}
    </div>
  );
}

export function ProductCard({
  product,
  qty,
  onChange,
  onAdded,
}: {
  product: Product;
  qty: number;
  onChange: (qty: number) => void;
  /** Recebe o aviso "N unid. de produto na lista" com a ação de desfazer. */
  onAdded?: (message: React.ReactNode, undo: () => void) => void;
}) {
  const producer = preferredProducer(product);
  const availableStock = Math.max(0, producer.stock);
  const step = Math.min(1, availableStock);
  const [inputValue, setInputValue] = useState(formatQuantity(qty));
  useEffect(() => setInputValue(formatQuantity(qty)), [qty]);

  const commit = (next: number) => {
    const confirmed = clampQuantity(next, availableStock);
    onChange(confirmed);
    return confirmed;
  };

  const firstAdd = () => {
    const added = commit(step);
    const message = (
      <span>
        <b>
          {formatQuantity(added)} {unitLabel(product.unit, added)}
        </b>{" "}
        de {product.name.split(" ")[0].toLowerCase()} na lista
      </span>
    );
    if (onAdded) onAdded(message, () => onChange(0));
    else toast.success(message, { action: { label: "Desfazer", onClick: () => onChange(0) } });
  };

  const commitInput = () => {
    const requested = parseQuantity(inputValue);
    if (requested > availableStock) {
      toast.error(
        `A quantidade máxima disponível é ${formatQuantity(availableStock)} ${product.unit}.`,
      );
    }
    commit(requested);
  };

  const controls =
    availableStock <= 0 ? null : qty > 0 ? (
      <div className="m-stepper m-ins">
        <button
          type="button"
          onClick={() => commit(qty - step)}
          aria-label={`Diminuir ${product.name}`}
        >
          <Minus className="lucide" aria-hidden />
        </button>
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={commitInput}
          onKeyDown={(event) => event.key === "Enter" && commitInput()}
          inputMode="decimal"
          aria-label={`Quantidade de ${product.name} em ${product.unit}`}
        />
        <button
          type="button"
          className="m-add"
          onClick={() => commit(qty + step)}
          aria-label={`Aumentar ${product.name}`}
        >
          <Plus className="lucide" aria-hidden />
        </button>
      </div>
    ) : (
      <button
        type="button"
        className="m-plus"
        onClick={firstAdd}
        aria-label={`Adicionar ${product.name} à lista`}
      >
        <Plus className="lucide" aria-hidden />
      </button>
    );

  return (
    <article className="m-pc">
      {product.imageUrl ? (
        <div className="m-ph">
          <img src={product.imageUrl} alt={product.name} />
          {controls}
        </div>
      ) : (
        <ProductFallback category={product.category} name={product.name} className="m-ph">
          {controls}
        </ProductFallback>
      )}
      <div className="m-bd">
        <Link to="/product" search={{ id: product.id }}>
          <b>{product.name}</b>
        </Link>
        <span>{producer.property}</span>
        {producer.sellerOrganizationName && <span>Pela {producer.sellerOrganizationName}</span>}
        <span className="m-price">
          {formatBRL(producer.price)} <small>/{product.unit}</small>
        </span>
      </div>
    </article>
  );
}
