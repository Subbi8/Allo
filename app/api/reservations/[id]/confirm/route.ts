import { NextRequest, NextResponse } from "next/server";
import type { Reservation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { getReplayResponse, saveIdempotentResponse } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = {};
  const replay = await getReplayResponse(req, body);
  if (replay) return replay;

  const { id } = await params;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const [confirmed] = await tx.$queryRaw<Reservation[]>`
      UPDATE "Reservation"
      SET "status" = 'confirmed'::"ReservationStatus", "confirmed_at" = ${now}, "updatedAt" = ${now}
      WHERE "id" = ${id}
        AND "status" = 'pending'::"ReservationStatus"
        AND "expires_at" > ${now}
      RETURNING *
    `;

    if (confirmed) {
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: confirmed.productId,
            warehouseId: confirmed.warehouseId
          }
        },
        data: {
          totalUnits: { decrement: confirmed.quantity },
          reservedUnits: { decrement: confirmed.quantity }
        }
      });

      const reservation = await tx.reservation.findUniqueOrThrow({
        where: { id },
        include: { product: true, warehouse: true }
      });
      return { kind: "ok" as const, reservation };
    }

    const existing = await tx.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true }
    });

    if (!existing) return { kind: "missing" as const };
    if (existing.status === "confirmed") return { kind: "ok" as const, reservation: existing };
    if (existing.status === "released") return { kind: "expired" as const };

    const [released] = await tx.$queryRaw<Reservation[]>`
      UPDATE "Reservation"
      SET "status" = 'released'::"ReservationStatus", "released_at" = ${now}, "updatedAt" = ${now}
      WHERE "id" = ${id}
        AND "status" = 'pending'::"ReservationStatus"
        AND "expires_at" <= ${now}
      RETURNING *
    `;

    if (released) {
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: released.productId,
            warehouseId: released.warehouseId
          }
        },
        data: { reservedUnits: { decrement: released.quantity } }
      });
    }

    return { kind: "expired" as const };
  });

  if (result.kind === "missing") {
    return jsonError(404, "NOT_FOUND", "Reservation not found.");
  }

  if (result.kind === "expired") {
    const response = {
      error: {
        code: "RESERVATION_EXPIRED",
        message: "This reservation has expired and the units were released."
      }
    };
    await saveIdempotentResponse(req, body, 410, response);
    return NextResponse.json(response, { status: 410 });
  }

  const response = {
    reservation: {
      id: result.reservation.id,
      status: result.reservation.status,
      quantity: result.reservation.quantity,
      expiresAt: result.reservation.expiresAt,
      product: {
        sku: result.reservation.product.sku,
        name: result.reservation.product.name,
        imageUrl: result.reservation.product.imageUrl
      },
      warehouse: {
        code: result.reservation.warehouse.code,
        name: result.reservation.warehouse.name
      }
    }
  };
  await saveIdempotentResponse(req, body, 200, response);
  return NextResponse.json(response);
}
