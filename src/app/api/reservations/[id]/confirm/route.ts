import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idempotencyKey = req.headers.get("Idempotency-Key");

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  // Idempotency: already confirmed
  if (reservation.status === "CONFIRMED") {
    return NextResponse.json({ id, status: "CONFIRMED" });
  }

  if (reservation.status === "RELEASED") {
    return NextResponse.json({ error: "Reservation was already released." }, { status: 409 });
  }

  if (reservation.expiresAt < new Date()) {
    // Lazy release expired reservation
    await prisma.$transaction(async (tx) => {
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });
      await tx.reservation.update({ where: { id }, data: { status: "RELEASED" } });
    });
    return NextResponse.json(
      { error: "Reservation has expired. Please start a new reservation." },
      { status: 410 }
    );
  }

  // Confirming: decrement total stock (reservation already held the units)
  await prisma.$transaction(async (tx) => {
    await tx.stock.update({
      where: { id: reservation.stockId },
      data: {
        totalQuantity: { decrement: reservation.quantity },
        reservedQuantity: { decrement: reservation.quantity },
      },
    });
    await tx.reservation.update({ where: { id }, data: { status: "CONFIRMED" } });
  });

  void idempotencyKey; // stored on the reservation row at creation time
  return NextResponse.json({ id, status: "CONFIRMED" });
}
