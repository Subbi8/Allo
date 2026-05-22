import { Prisma, PrismaClient, type Reservation } from "@prisma/client";

type ExpiredReservation = Pick<Reservation, "id" | "productId" | "warehouseId" | "quantity">;

export async function releaseExpiredReservations(prisma: PrismaClient) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const expired = await tx.$queryRaw<ExpiredReservation[]>`
      UPDATE "Reservation"
      SET "status" = 'released'::"ReservationStatus", "released_at" = ${now}, "updatedAt" = ${now}
      WHERE "status" = 'pending'::"ReservationStatus" AND "expires_at" <= ${now}
      RETURNING "id", "productId", "warehouseId", "quantity"
    `;

    if (expired.length === 0) {
      return { released: 0 };
    }

    await releaseStock(tx, expired);
    return { released: expired.length };
  });
}

async function releaseStock(tx: Prisma.TransactionClient, reservations: ExpiredReservation[]) {
  const totals = new Map<string, ExpiredReservation>();

  for (const reservation of reservations) {
    const key = `${reservation.productId}:${reservation.warehouseId}`;
    const existing = totals.get(key);
    if (existing) {
      existing.quantity += reservation.quantity;
    } else {
      totals.set(key, { ...reservation });
    }
  }

  for (const reservation of totals.values()) {
    await tx.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId
        }
      },
      data: {
        reservedUnits: {
          decrement: reservation.quantity
        }
      }
    });
  }
}
