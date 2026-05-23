"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreateReservationSchema } from "@/lib/schemas";

type Props = {
  productId: string;
  warehouseId: string;
  availableQuantity: number;
};

export function ReserveButton({ productId, warehouseId, availableQuantity }: Props) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxQty = Math.min(availableQuantity, 10);

  async function handleReserve() {
    // Validate client-side with the same schema the API uses
    const validation = CreateReservationSchema.safeParse({ productId, warehouseId, quantity });
    if (!validation.success) {
      setError("Invalid reservation data.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ productId, warehouseId, quantity }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (res.status === 409) {
        setError("Someone just grabbed the last unit. Please refresh.");
        return;
      }
      if (!res.ok || !data.id) {
        setError(data.error ?? "Failed to reserve.");
        return;
      }
      router.push(`/reservation/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  if (availableQuantity < 1) {
    return (
      <Button size="sm" disabled variant="outline">
        Out of stock
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-red-600 text-right">{error}</p>}
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          disabled={loading}
        >
          {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={handleReserve} disabled={loading}>
          {loading ? "Reserving…" : "Reserve"}
        </Button>
      </div>
    </div>
  );
}
