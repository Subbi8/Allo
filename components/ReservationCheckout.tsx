"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, PackageCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReservationView } from "@/lib/types";

function apiErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error
  ) {
    return String(payload.error.message);
  }

  return fallback;
}

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function ReservationCheckout({ initialReservation }: { initialReservation: ReservationView }) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"confirm" | "release" | null>(null);

  const remainingMs = useMemo(
    () => new Date(reservation.expiresAt).getTime() - now,
    [now, reservation.expiresAt]
  );
  const isExpired = remainingMs <= 0 && reservation.status === "pending";
  const isPending = reservation.status === "pending" && !isExpired;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshReservation() {
    const response = await fetch(`/api/reservations/${reservation.id}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setReservation(payload.reservation);
    }
  }

  async function act(action: "confirm" | "release") {
    setBusyAction(action);
    setMessage(null);
    const response = await fetch(`/api/reservations/${reservation.id}/${action}`, {
      method: "POST",
      headers: action === "confirm" ? { "Idempotency-Key": crypto.randomUUID() } : undefined
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(apiErrorMessage(payload, "The reservation could not be updated."));
      await refreshReservation();
      router.refresh();
      setBusyAction(null);
      return;
    }

    setReservation(payload.reservation);
    setMessage(action === "confirm" ? "Purchase confirmed." : "Reservation cancelled and stock released.");
    router.refresh();
    setBusyAction(null);
  }

  return (
    <main className="min-h-screen bg-mist">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 md:px-8">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-fit rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:border-sage"
        >
          Back to inventory
        </button>

        <section className="overflow-hidden rounded-md border border-line bg-white shadow-panel">
          <div className="grid md:grid-cols-[280px_1fr]">
            <Image
              src={reservation.product.imageUrl}
              alt=""
              width={560}
              height={520}
              sizes="(min-width: 768px) 280px, 100vw"
              className="h-64 w-full object-cover md:h-full"
            />
            <div className="flex flex-col gap-6 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-sage">{reservation.product.sku}</p>
                  <h1 className="mt-1 text-3xl font-semibold">{reservation.product.name}</h1>
                  <p className="mt-2 text-sm text-ink/65">
                    {reservation.quantity} unit held at {reservation.warehouse.name}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-md bg-mist px-3 py-2 text-sm font-semibold text-sage">
                  <PackageCheck className="h-4 w-4" />
                  {reservation.status}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-line p-4">
                  <p className="text-sm text-ink/55">Warehouse</p>
                  <p className="mt-1 font-semibold">{reservation.warehouse.code}</p>
                </div>
                <div className="rounded-md border border-line p-4">
                  <p className="text-sm text-ink/55">Quantity</p>
                  <p className="mt-1 font-semibold">{reservation.quantity}</p>
                </div>
                <div className="rounded-md border border-line p-4">
                  <p className="text-sm text-ink/55">Time left</p>
                  <p className="mt-1 flex items-center gap-2 font-semibold">
                    <Clock3 className="h-4 w-4" />
                    {reservation.status === "pending" ? formatRemaining(remainingMs) : "Complete"}
                  </p>
                </div>
              </div>

              {isExpired && (
                <div className="flex items-start gap-3 rounded-md border border-amber/40 bg-mist p-4 text-sm">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
                  <p>This hold has reached its expiry time. Confirming now will return a 410 and release the units.</p>
                </div>
              )}

              {message && (
                <div className="flex items-start gap-3 rounded-md border border-line bg-mist p-4 text-sm">
                  {reservation.status === "confirmed" ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sage" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
                  )}
                  <p>{message}</p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={!isPending || busyAction !== null}
                  onClick={() => act("confirm")}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-berry px-4 text-sm font-semibold text-white transition hover:bg-berry/90 disabled:cursor-not-allowed disabled:bg-ink/25"
                >
                  {busyAction === "confirm" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirm purchase
                </button>
                <button
                  type="button"
                  disabled={reservation.status !== "pending" || busyAction !== null}
                  onClick={() => act("release")}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-sage disabled:cursor-not-allowed disabled:bg-ink/5 disabled:text-ink/35"
                >
                  {busyAction === "release" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
