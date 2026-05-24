"use client";

import * as React from "react";
import { Clock, PackageCheck, RefreshCw, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch, type ProductListItem, type ReservationDetails } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";

export function ProductList() {
  const router = useRouter();
  const { toast } = useToast();
  const [products, setProducts] = React.useState<ProductListItem[]>([]);
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [submittingStockId, setSubmittingStockId] = React.useState<string | null>(null);

  const loadProducts = React.useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await apiFetch<ProductListItem[]>("/api/products"));
    } catch (error) {
      toast({
        title: "Could not load products",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function reserve(productId: string, warehouseId: string, stockId: string) {
    const quantity = quantities[stockId] ?? 1;
    setSubmittingStockId(stockId);

    try {
      const reservation = await apiFetch<ReservationDetails>("/api/reservations", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ productId, warehouseId, quantity })
      });

      toast({
        title: "Inventory reserved",
        description: "Your hold is active for 10 minutes."
      });
      router.push(`/checkout/${reservation.id}`);
    } catch (error) {
      toast({
        title: error instanceof Error && "status" in error && error.status === 409 ? "Insufficient stock" : "Reservation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
      await loadProducts();
    } finally {
      setSubmittingStockId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Concurrency-safe checkout</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Inventory Reservations</h1>
        </div>
        <Button variant="outline" onClick={() => void loadProducts()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr] gap-4 border-b bg-muted/55 px-4 py-3 text-sm font-semibold text-muted-foreground max-md:hidden">
          <span>Product</span>
          <span>Warehouse</span>
          <span>Available</span>
          <span>Action</span>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading inventory...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">No products found.</div>
        ) : (
          products.flatMap((product) =>
            product.warehouses.map((warehouse) => {
              const quantity = quantities[warehouse.stockId] ?? 1;
              const disabled =
                warehouse.availableUnits <= 0 ||
                quantity > warehouse.availableUnits ||
                submittingStockId === warehouse.stockId;

              return (
                <div
                  key={warehouse.stockId}
                  className="grid grid-cols-[1.2fr_1fr_0.8fr_1fr] items-center gap-4 border-b px-4 py-4 last:border-b-0 max-md:grid-cols-1"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {product.sku} · {formatCurrency(product.price)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">{warehouse.warehouseName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{warehouse.location}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <PackageCheck className="h-4 w-4 text-primary" />
                    <span>{warehouse.availableUnits}</span>
                    <span className="text-muted-foreground">of {warehouse.totalUnits}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`Quantity for ${product.name} at ${warehouse.warehouseName}`}
                      className="h-10 w-20 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      min={1}
                      max={Math.max(warehouse.availableUnits, 1)}
                      type="number"
                      value={quantity}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [warehouse.stockId]: Number(event.target.value)
                        }))
                      }
                    />
                    <Button
                      disabled={disabled}
                      onClick={() => void reserve(product.id, warehouse.warehouseId, warehouse.stockId)}
                    >
                      {submittingStockId === warehouse.stockId ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                      Reserve
                    </Button>
                  </div>
                </div>
              );
            })
          )
        )}
      </section>
    </main>
  );
}
