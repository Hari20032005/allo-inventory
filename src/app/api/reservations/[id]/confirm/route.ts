import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIdempotentResponse, setIdempotentResponse } from "@/lib/idempotency";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idempotencyKey = req.headers.get("Idempotency-Key");

  // Return cached response for duplicate requests with the same key
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(`confirm:${idempotencyKey}`);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json({ id, status: "CONFIRMED" });
  }

  if (reservation.status === "RELEASED") {
    return NextResponse.json({ error: "Reservation was already released." }, { status: 409 });
  }

  if (reservation.expiresAt < new Date()) {
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

  // Confirming: permanently decrement total stock and clear the reservation hold
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

  const responseBody = { id, status: "CONFIRMED" };

  if (idempotencyKey) {
    await setIdempotentResponse(`confirm:${idempotencyKey}`, 200, responseBody);
  }

  return NextResponse.json(responseBody);
}
