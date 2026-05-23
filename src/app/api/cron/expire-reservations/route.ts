import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Vercel Cron: runs every minute  (see vercel.json)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all expired PENDING reservations
  const expired = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    select: { id: true, stockId: true, quantity: true },
  });

  if (!expired.length) {
    return NextResponse.json({ released: 0 });
  }

  // Release each in its own transaction to avoid a single big lock
  let released = 0;
  for (const r of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.stock.update({
          where: { id: r.stockId },
          data: { reservedQuantity: { decrement: r.quantity } },
        });
        await tx.reservation.update({
          where: { id: r.id },
          data: { status: "RELEASED" },
        });
      });
      released++;
    } catch {
      // Log but continue — the reservation will be caught on next cron run
      console.error(`Failed to release reservation ${r.id}`);
    }
  }

  return NextResponse.json({ released });
}
