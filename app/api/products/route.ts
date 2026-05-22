import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export const dynamic = "force-dynamic";

export async function GET() {
  await releaseExpiredReservations(prisma);

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      stockLevels: {
        include: { warehouse: true },
        orderBy: { warehouse: { code: "asc" } }
      }
    }
  });

  return NextResponse.json({
    products: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      warehouses: product.stockLevels.map((stock) => ({
        warehouseId: stock.warehouseId,
        code: stock.warehouse.code,
        name: stock.warehouse.name,
        city: stock.warehouse.city,
        region: stock.warehouse.region,
        totalUnits: stock.totalUnits,
        reservedUnits: stock.reservedUnits,
        availableUnits: stock.totalUnits - stock.reservedUnits
      }))
    }))
  });
}
