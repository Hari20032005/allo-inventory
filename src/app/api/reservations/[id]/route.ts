import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ReservationWithRelations, ReservationResponse } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { stock: { include: { product: true, warehouse: true } } },
  }) as ReservationWithRelations | null;

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  // Lazy expiry: release inline if the timer ran out
  if (reservation.status === "PENDING" && reservation.expiresAt < new Date()) {
    const released = await prisma.$transaction(async (tx) => {
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });
      return tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
        include: { stock: { include: { product: true, warehouse: true } } },
      }) as Promise<ReservationWithRelations>;
    });
    return NextResponse.json(formatReservation(released));
  }

  return NextResponse.json(formatReservation(reservation));
}

function formatReservation(r: ReservationWithRelations): ReservationResponse {
  return {
    id: r.id,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    stock: {
      id: r.stock.id,
      productId: r.stock.productId,
      warehouseId: r.stock.warehouseId,
      product: {
        id: r.stock.product.id,
        name: r.stock.product.name,
        sku: r.stock.product.sku,
        price: Number(r.stock.product.price),
        description: r.stock.product.description,
        imageUrl: r.stock.product.imageUrl,
      },
      warehouse: {
        id: r.stock.warehouse.id,
        name: r.stock.warehouse.name,
        location: r.stock.warehouse.location,
      },
    },
  };
}
