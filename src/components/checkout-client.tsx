"use client";

import * as React from "react";
import { Ban, Check, Clock, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch, type ReservationDetails } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";

function formatCountdown(expiresAt: string) {
  const remainingMs = Math.max(new Date(expiresAt).getTime() - Date.now(), 0);
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function CheckoutClient({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [reservation, setReservation] = React.useState<ReservationDetails | null>(null);
  const [countdown, setCountdown] = React.useState("00:00");
  const [loading, setLoading] = React.useState(true);
  const [action, setAction] = React.useState<"confirm" | "release" | null>(null);

  const loadReservation = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ReservationDetails>(`/api/reservations/${reservationId}`);
      setReservation(data);
      setCountdown(formatCountdown(data.expiresAt));
    } catch (error) {
      toast({
        title: "Could not load reservation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [reservationId, toast]);

  React.useEffect(() => {
    void loadReservation();
  }, [loadReservation]);

  React.useEffect(() => {
    if (!reservation || reservation.status !== "PENDING") {
      return;
    }

    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(reservation.expiresAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [reservation]);

  async function mutateReservation(kind: "confirm" | "release") {
    if (!reservation) {
      return;
    }

    const previous = reservation;
    const optimisticStatus = kind === "confirm" ? "CONFIRMED" : "RELEASED";
    setReservation({ ...reservation, status: optimisticStatus });
    setAction(kind);

    try {
      const updated = await apiFetch<ReservationDetails>(`/api/reservations/${reservation.id}/${kind}`, {
        method: "POST",
        headers: kind === "confirm" ? { "Idempotency-Key": crypto.randomUUID() } : undefined
      });
      setReservation(updated);
      toast({
        title: kind === "confirm" ? "Purchase confirmed" : "Reservation canceled",
        description: kind === "confirm" ? "Stock has been permanently decremented." : "Held units are available again."
      });
    } catch (error) {
      setReservation(previous);
      toast({
        title:
          error instanceof Error && "status" in error && error.status === 410
            ? "Reservation expired"
            : "Action failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
      await loadReservation();
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading reservation...
        </div>
      </main>
    );
  }

  if (!reservation) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Button onClick={() => router.push("/")}>Back to inventory</Button>
      </main>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isExpired = isPending && new Date(reservation.expiresAt).getTime() <= Date.now();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-8">
      <Button className="w-fit" variant="outline" onClick={() => router.push("/")}>
        Back to inventory
      </Button>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Reservation {reservation.id}</p>
            <h1 className="mt-2 text-2xl font-semibold">{reservation.stock.product.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {reservation.stock.product.sku} · {formatCurrency(reservation.stock.product.price)}
            </p>
          </div>
          <div className="rounded-md border px-4 py-3 text-left sm:text-right">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
            <p className="mt-1 text-lg font-semibold">{reservation.status}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">Quantity</p>
            <p className="mt-2 text-xl font-semibold">{reservation.quantity}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">Warehouse</p>
            <p className="mt-2 font-semibold">{reservation.stock.warehouse.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{reservation.stock.warehouse.location}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">Hold expires in</p>
            <div className="mt-2 flex items-center gap-2 text-xl font-semibold">
              <Clock className="h-5 w-5 text-primary" />
              {reservation.status === "PENDING" ? countdown : "--:--"}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            disabled={!isPending || isExpired || action !== null}
            onClick={() => void mutateReservation("confirm")}
          >
            <Check className="h-4 w-4" />
            Confirm purchase
          </Button>
          <Button
            disabled={!isPending || action !== null}
            variant="outline"
            onClick={() => void mutateReservation("release")}
          >
            <Ban className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </section>
    </main>
  );
}
