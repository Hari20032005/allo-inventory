import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (reservation.status !== "PENDING") {
    return NextResponse.json({ id, status: reservation.status });
  }

  await prisma.$transaction(async (tx) => {
    await tx.stock.update({
      where: { id: reservation.stockId },
      data: { reservedQuantity: { decrement: reservation.quantity } },
    });
    await tx.reservation.update({ where: { id }, data: { status: "RELEASED" } });
  });

  return NextResponse.json({ id, status: "RELEASED" });
}
