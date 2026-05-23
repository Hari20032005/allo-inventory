"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type ReservationDetail = {
  id: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  stock: {
    id: string;
    product: {
      name: string;
      sku: string;
      price: number;
      description: string | null;
      imageUrl: string | null;
    };
    warehouse: { name: string; location: string };
  };
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  RELEASED: "Released",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "default",
  CONFIRMED: "secondary",
  RELEASED: "destructive",
};

export default function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const fetchReservation = useCallback(async () => {
    const res = await fetch(`/api/reservations/${id}`);
    const data = await res.json();
    if (res.ok) setReservation(data);
    else setError(data.error ?? "Failed to load reservation.");
  }, [id]);

  useEffect(() => {
    fetchReservation().finally(() => setLoading(false));
  }, [fetchReservation]);

  // Tick every second to update countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-fetch when timer hits zero so UI reflects the RELEASED status
  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING") return;
    const remaining = new Date(reservation.expiresAt).getTime() - now;
    if (remaining <= 0) fetchReservation();
  }, [now, reservation, fetchReservation]);

  async function handleConfirm() {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (res.status === 410) {
        setError("Your reservation has expired. Please go back and reserve again.");
        await fetchReservation();
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not confirm.");
        return;
      }
      setReservation((prev) => prev && { ...prev, status: "CONFIRMED" });
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not cancel.");
        return;
      }
      setReservation((prev) => prev && { ...prev, status: "RELEASED" });
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading reservation…</p>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error ?? "Reservation not found."}</p>
      </div>
    );
  }

  const expiresAt = new Date(reservation.expiresAt).getTime();
  const remaining = expiresAt - now;
  const isPending = reservation.status === "PENDING";
  const isExpiredPending = isPending && remaining <= 0;

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <button
        onClick={() => router.push("/")}
        className="text-sm text-muted-foreground mb-6 hover:underline flex items-center gap-1"
      >
        ← Back to products
      </button>

      <Card>
        {reservation.stock.product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reservation.stock.product.imageUrl}
            alt={reservation.stock.product.name}
            className="w-full h-52 object-cover rounded-t-lg"
          />
        )}
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>{reservation.stock.product.name}</CardTitle>
            <Badge variant={STATUS_VARIANTS[reservation.status]}>
              {STATUS_LABELS[reservation.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">SKU: {reservation.stock.product.sku}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Warehouse</span>
            <span className="font-medium">
              {reservation.stock.warehouse.name}
              <span className="text-muted-foreground font-normal">
                {" "}
                · {reservation.stock.warehouse.location}
              </span>
            </span>

            <span className="text-muted-foreground">Quantity</span>
            <span className="font-medium">{reservation.quantity}</span>

            <span className="text-muted-foreground">Unit price</span>
            <span className="font-medium">₹{reservation.stock.product.price.toLocaleString()}</span>

            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-base">
              ₹{(reservation.stock.product.price * reservation.quantity).toLocaleString()}
            </span>
          </div>

          <Separator />

          {isPending && (
            <div
              className={`rounded-md px-4 py-3 text-center font-mono text-2xl font-bold ${
                isExpiredPending
                  ? "bg-red-50 text-red-600"
                  : remaining < 60_000
                  ? "bg-orange-50 text-orange-600"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {isExpiredPending ? "Expired" : formatCountdown(remaining)}
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                {isExpiredPending ? "This reservation has expired" : "Remaining to complete payment"}
              </p>
            </div>
          )}

          {reservation.status === "CONFIRMED" && (
            <div className="rounded-md bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm text-center">
              Payment confirmed. Your order is placed.
            </div>
          )}

          {reservation.status === "RELEASED" && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm text-center">
              This reservation has been released. The units are available again.
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {isPending && !isExpiredPending && (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={acting}
              >
                {acting ? "Processing…" : "Confirm purchase"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancel}
                disabled={acting}
              >
                Cancel
              </Button>
            </div>
          )}

          {(isExpiredPending || reservation.status === "RELEASED") && (
            <Button className="w-full" onClick={() => router.push("/")}>
              Back to products
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Reservation ID: {reservation.id}
      </p>
    </main>
  );
}
