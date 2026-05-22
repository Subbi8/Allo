"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, Loader2, MapPin, PackageCheck, RefreshCcw, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProductWithStock } from "@/lib/types";

type ProductsResponse = {
  products: ProductWithStock[];
};

function apiErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error
  ) {
    return String(payload.error.message);
  }

  return fallback;
}

export function ProductList({ initialProducts }: { initialProducts: ProductWithStock[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const totalAvailable = useMemo(
    () =>
      products.reduce(
        (sum, product) =>
          sum + product.warehouses.reduce((warehouseSum, stock) => warehouseSum + stock.availableUnits, 0),
        0
      ),
    [products]
  );

  async function refreshProducts() {
    setIsRefreshing(true);
    const response = await fetch("/api/products", { cache: "no-store" });
    const payload = (await response.json()) as ProductsResponse;
    setProducts(payload.products);
    setIsRefreshing(false);
  }

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  async function reserve(productId: string, warehouseId: string) {
    const key = `${productId}:${warehouseId}`;
    setBusyKey(key);
    setNotice(null);

    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify({ productId, warehouseId, quantity: 1 })
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(apiErrorMessage(payload, "Could not reserve this item."));
      await refreshProducts();
      setBusyKey(null);
      return;
    }

    router.push(`/reservations/${payload.reservation.id}`);
  }

  return (
    <main className="min-h-screen bg-mist">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 md:px-8">
        <header className="flex flex-col gap-5 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-berry">Allo inventory</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-ink md:text-5xl">
              Reserve stock before checkout.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink/70">
              Inventory is reserved per warehouse with expiry, confirmation, and early release.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshProducts}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-sage"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-line bg-white p-4 shadow-panel">
            <p className="text-sm text-ink/60">Products</p>
            <p className="mt-1 text-3xl font-semibold">{products.length}</p>
          </div>
          <div className="rounded-md border border-line bg-white p-4 shadow-panel">
            <p className="text-sm text-ink/60">Available units</p>
            <p className="mt-1 text-3xl font-semibold">{totalAvailable}</p>
          </div>
          <div className="rounded-md border border-line bg-white p-4 shadow-panel">
            <p className="text-sm text-ink/60">Reservation TTL</p>
            <p className="mt-1 text-3xl font-semibold">5 min</p>
          </div>
        </section>

        {notice && (
          <div className="flex items-start gap-3 rounded-md border border-amber/40 bg-white p-4 text-sm text-ink shadow-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
            <p>{notice}</p>
          </div>
        )}

        <section className="grid gap-5">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
              <div className="grid md:grid-cols-[220px_1fr]">
                <Image
                  src={product.imageUrl}
                  alt=""
                  width={440}
                  height={360}
                  sizes="(min-width: 768px) 220px, 100vw"
                  className="h-56 w-full object-cover md:h-full"
                />
                <div className="flex flex-col gap-5 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-sage">{product.sku}</p>
                      <h2 className="mt-1 text-2xl font-semibold">{product.name}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">{product.description}</p>
                    </div>
                    <div className="inline-flex w-fit items-center gap-2 rounded-md bg-mist px-3 py-2 text-sm font-semibold text-sage">
                      <PackageCheck className="h-4 w-4" />
                      {product.warehouses.reduce((sum, stock) => sum + stock.availableUnits, 0)} available
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    {product.warehouses.map((stock) => {
                      const key = `${product.id}:${stock.warehouseId}`;
                      const disabled = stock.availableUnits <= 0 || busyKey === key;

                      return (
                        <div key={stock.warehouseId} className="rounded-md border border-line p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{stock.name}</p>
                              <p className="mt-1 flex items-center gap-1 text-sm text-ink/60">
                                <MapPin className="h-3.5 w-3.5" />
                                {stock.city}, {stock.region}
                              </p>
                            </div>
                            <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-sage">
                              {stock.code}
                            </span>
                          </div>
                          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <dt className="text-ink/50">Total</dt>
                              <dd className="font-semibold">{stock.totalUnits}</dd>
                            </div>
                            <div>
                              <dt className="text-ink/50">Held</dt>
                              <dd className="font-semibold">{stock.reservedUnits}</dd>
                            </div>
                            <div>
                              <dt className="text-ink/50">Free</dt>
                              <dd className="font-semibold">{stock.availableUnits}</dd>
                            </div>
                          </dl>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => reserve(product.id, stock.warehouseId)}
                            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-berry px-4 text-sm font-semibold text-white transition hover:bg-berry/90 disabled:cursor-not-allowed disabled:bg-ink/25"
                          >
                            {busyKey === key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShoppingCart className="h-4 w-4" />
                            )}
                            Reserve
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
