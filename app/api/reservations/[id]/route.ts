import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await releaseExpiredReservations(prisma);
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: true,
      warehouse: true
    }
  });

  if (!reservation) {
    return jsonError(404, "NOT_FOUND", "Reservation not found.");
  }

  return NextResponse.json({
    reservation: {
      id: reservation.id,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      product: {
        sku: reservation.product.sku,
        name: reservation.product.name,
        imageUrl: reservation.product.imageUrl
      },
      warehouse: {
        code: reservation.warehouse.code,
        name: reservation.warehouse.name,
        city: reservation.warehouse.city,
        region: reservation.warehouse.region
      }
    }
  });
}
