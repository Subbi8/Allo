import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    sku: "BAG-ATLAS-24",
    name: "Atlas Weekender",
    description: "Structured canvas carryall with a recycled nylon lining.",
    imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80"
  },
  {
    sku: "JKT-RIDGE-02",
    name: "Ridge Shell Jacket",
    description: "Lightweight waterproof shell built for changing weather.",
    imageUrl: "https://images.unsplash.com/photo-1520975682031-a74a256e3d3d?auto=format&fit=crop&w=900&q=80"
  },
  {
    sku: "BOT-CAMP-18",
    name: "Camp Bottle",
    description: "Insulated steel bottle with a leakproof loop cap.",
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80"
  }
];

const warehouses = [
  { code: "EAST", name: "East Fulfillment", city: "Newark", region: "NJ" },
  { code: "WEST", name: "West Fulfillment", city: "Reno", region: "NV" },
  { code: "CENTRAL", name: "Central Fulfillment", city: "Kansas City", region: "MO" }
];

async function main() {
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const createdProducts = await Promise.all(
    products.map((product) => prisma.product.create({ data: product }))
  );
  const createdWarehouses = await Promise.all(
    warehouses.map((warehouse) => prisma.warehouse.create({ data: warehouse }))
  );

  for (const [productIndex, product] of createdProducts.entries()) {
    for (const [warehouseIndex, warehouse] of createdWarehouses.entries()) {
      await prisma.stockLevel.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          totalUnits: 3 + productIndex + warehouseIndex,
          reservedUnits: 0
        }
      });
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
