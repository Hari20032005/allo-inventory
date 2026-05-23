import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReserveButton } from "./components/ReserveButton";

export const dynamic = "force-dynamic";

async function getProducts() {
  return prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true },
        orderBy: { warehouse: { name: "asc" } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export default async function ProductListingPage() {
  const products = await getProducts();

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Inventory</h1>
      <p className="text-muted-foreground mb-8">
        Reserve a unit to hold it for 10 minutes while you complete checkout.
      </p>

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
                <span className="text-xl font-semibold">
                  ₹{Number(product.price).toLocaleString()}
                </span>
              </div>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {product.stocks.map((stock) => {
                const available = stock.totalQuantity - stock.reservedQuantity;
                return (
                  <div
                    key={stock.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{stock.warehouse.name}</p>
                      <p className="text-xs text-muted-foreground">{stock.warehouse.location}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge
                          variant={available > 0 ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {available > 0 ? `${available} available` : "Out of stock"}
                        </Badge>
                        {stock.reservedQuantity > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {stock.reservedQuantity} reserved
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ReserveButton
                      productId={product.id}
                      warehouseId={stock.warehouseId}
                      availableQuantity={available}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
