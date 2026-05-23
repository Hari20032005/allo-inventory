"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StockEntry = {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  stocks: StockEntry[];
};

export default function ProductListingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  async function handleReserve(productId: string, warehouseId: string, stockId: string) {
    setReserving(stockId);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to reserve.");
        return;
      }
      router.push(`/reservation/${data.id}`);
    } finally {
      setReserving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading products…</p>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Inventory</h1>
      <p className="text-muted-foreground mb-8">
        Reserve a unit to hold it for 10 minutes while you complete checkout.
      </p>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {products.map((product) => (
          <Card key={product.id}>
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-48 object-cover rounded-t-lg"
              />
            )}
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">SKU: {product.sku}</p>
                </div>
                <span className="text-xl font-semibold">₹{product.price.toLocaleString()}</span>
              </div>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {product.stocks.map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{stock.warehouseName}</p>
                    <p className="text-xs text-muted-foreground">{stock.warehouseLocation}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge
                        variant={stock.availableQuantity > 0 ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {stock.availableQuantity > 0
                          ? `${stock.availableQuantity} available`
                          : "Out of stock"}
                      </Badge>
                      {stock.reservedQuantity > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {stock.reservedQuantity} reserved
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={stock.availableQuantity < 1 || reserving === stock.id}
                    onClick={() => handleReserve(product.id, stock.warehouseId, stock.id)}
                  >
                    {reserving === stock.id ? "Reserving…" : "Reserve"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
