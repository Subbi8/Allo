import { notFound } from "next/navigation";
import { ReservationCheckout } from "@/components/ReservationCheckout";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import type { ReservationView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
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
    notFound();
  }

  const initialReservation: ReservationView = {
    id: reservation.id,
    productId: reservation.productId,
    warehouseId: reservation.warehouseId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
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
  };

  return <ReservationCheckout initialReservation={initialReservation} />;
}
