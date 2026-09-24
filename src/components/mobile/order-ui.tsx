import { ProductFallback } from "@/components/marketplace/ProductCard";
import type { Product } from "@/lib/catalog";
import type { OrderStatus, SavedOrder } from "@/lib/orders";
import { STATUS_CHIP } from "@/lib/order-status";

export function StatusChip({ status, label }: { status: OrderStatus; label?: string }) {
  return <span className={`m-chip ${STATUS_CHIP[status]} m-st-dot`}>{label ?? status}</span>;
}

/** Miniaturas redondas sobrepostas com a foto de cada produto (ou o ícone da categoria). */
export function OrderThumbs({
  order,
  products,
  max = 2,
}: {
  order: SavedOrder;
  products: Product[];
  max?: number;
}) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const withPhoto = order.items.filter((item) => byId.get(item.productId)?.imageUrl);
  const shown = (withPhoto.length ? withPhoto : order.items).slice(0, max);
  return (
    <div className="m-th">
      {shown.map((item) => {
        const product = byId.get(item.productId);
        return product?.imageUrl ? (
          <img key={item.productId} src={product.imageUrl} alt="" />
        ) : (
          <ProductFallback
            key={item.productId}
            category={product?.category ?? ""}
            name={item.productName}
            className="m-thf"
            label={false}
          />
        );
      })}
    </div>
  );
}
