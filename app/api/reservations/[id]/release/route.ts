import { NextResponse } from "next/server";
import type { Reservation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const [released] = await tx.$queryRaw<Reservation[]>`
      UPDATE "Reservation"
      SET "status" = 'released'::"ReservationStatus", "released_at" = ${now}, "updatedAt" = ${now}
      WHERE "id" = ${id}
        AND "status" = 'pending'::"ReservationStatus"
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

    return tx.reservation.findUnique({
      where: { id },
      include: {
        product: true,
        warehouse: true
      }
    });
  });

  if (!result) {
    return jsonError(404, "NOT_FOUND", "Reservation not found.");
  }

  return NextResponse.json({
    reservation: {
      id: result.id,
      status: result.status,
      quantity: result.quantity,
      expiresAt: result.expiresAt,
      product: {
        sku: result.product.sku,
        name: result.product.name,
        imageUrl: result.product.imageUrl
      },
      warehouse: {
        code: result.warehouse.code,
        name: result.warehouse.name
      }
    }
  });
}
