import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const data = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    price: Number(p.price),
    imageUrl: p.imageUrl,
    stocks: p.stocks.map((s) => ({
      id: s.id,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      totalQuantity: s.totalQuantity,
      reservedQuantity: s.reservedQuantity,
      availableQuantity: s.totalQuantity - s.reservedQuantity,
    })),
  }));

  return NextResponse.json(data);
}
