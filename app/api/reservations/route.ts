import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";
import { jsonError, validationError } from "@/lib/http";
import { getReplayResponse, saveIdempotentResponse } from "@/lib/idempotency";
import { reserveSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type StockRow = {
  id: string;
  productId: string;
  warehouseId: string;
  total_units: number;
  reserved_units: number;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const replay = await getReplayResponse(req, body);
  if (replay) return replay;

  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  await releaseExpiredReservations(prisma);

  const ttlSeconds = Number(process.env.RESERVATION_TTL_SECONDS ?? 300);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const [stock] = await tx.$queryRaw<StockRow[]>`
      UPDATE "stock_levels"
      SET "reserved_units" = "reserved_units" + ${parsed.data.quantity}
      WHERE "productId" = ${parsed.data.productId}
        AND "warehouseId" = ${parsed.data.warehouseId}
        AND ("total_units" - "reserved_units") >= ${parsed.data.quantity}
      RETURNING "id", "productId", "warehouseId", "total_units", "reserved_units"
    `;

    if (!stock) {
      return null;
    }

    return tx.reservation.create({
      data: {
        productId: parsed.data.productId,
        warehouseId: parsed.data.warehouseId,
        quantity: parsed.data.quantity,
        expiresAt
      },
      include: {
        product: true,
        warehouse: true
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

  if (!result) {
    const response = {
      error: {
        code: "NOT_ENOUGH_STOCK",
        message: "There is not enough available stock in that warehouse."
      }
    };
    await saveIdempotentResponse(req, body, 409, response);
    return NextResponse.json(response, { status: 409 });
  }

  const response = {
    reservation: {
      id: result.id,
      productId: result.productId,
      warehouseId: result.warehouseId,
      quantity: result.quantity,
      status: result.status,
      expiresAt: result.expiresAt,
      product: {
        sku: result.product.sku,
        name: result.product.name,
        imageUrl: result.product.imageUrl
      },
      warehouse: {
        code: result.warehouse.code,
        name: result.warehouse.name,
        city: result.warehouse.city,
        region: result.warehouse.region
      }
    }
  };

  await saveIdempotentResponse(req, body, 201, response);
  return NextResponse.json(response, { status: 201 });
}
