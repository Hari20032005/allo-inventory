import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateReservationSchema } from "@/lib/schemas";
import { getIdempotentResponse, setIdempotentResponse } from "@/lib/idempotency";
import { Prisma } from "@prisma/client";

const RESERVATION_TTL_MINUTES = 10;

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("Idempotency-Key");

  // Return cached response for duplicate requests with the same key
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(`reserve:${idempotencyKey}`);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { productId, warehouseId, quantity } = parsed.data;

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE locks this row for the duration of the transaction,
      // preventing concurrent reservations from reading a stale reservedQuantity.
      const stocks = await tx.$queryRaw<
        { id: string; total_quantity: number; reserved_quantity: number }[]
      >(Prisma.sql`
        SELECT id, "totalQuantity" AS total_quantity, "reservedQuantity" AS reserved_quantity
        FROM "Stock"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `);

      if (!stocks.length) {
        throw new Error("STOCK_NOT_FOUND");
      }

      const stock = stocks[0];
      const available = stock.total_quantity - stock.reserved_quantity;

      if (available < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      await tx.stock.update({
        where: { id: stock.id },
        data: { reservedQuantity: { increment: quantity } },
      });

      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

      return tx.reservation.create({
        data: {
          stockId: stock.id,
          quantity,
          expiresAt,
          // Store the key on the row as a secondary idempotency guard
          idempotencyKey: idempotencyKey ?? undefined,
        },
        include: { stock: { include: { product: true, warehouse: true } } },
      });
    });

    const responseBody = formatReservation(reservation);

    // Cache the successful response in Redis
    if (idempotencyKey) {
      await setIdempotentResponse(`reserve:${idempotencyKey}`, 201, responseBody);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Not enough stock available." }, { status: 409 });
    }
    if (message === "STOCK_NOT_FOUND") {
      return NextResponse.json({ error: "Stock record not found." }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatReservation(r: any) {
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
