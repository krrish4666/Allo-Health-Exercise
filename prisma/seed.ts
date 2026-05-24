import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const east = await prisma.warehouse.upsert({
    where: { id: "wh_east" },
    update: {},
    create: {
      id: "wh_east",
      name: "East Fulfillment",
      location: "Newark, NJ"
    }
  });

  const west = await prisma.warehouse.upsert({
    where: { id: "wh_west" },
    update: {},
    create: {
      id: "wh_west",
      name: "West Fulfillment",
      location: "Reno, NV"
    }
  });

  const keyboard = await prisma.product.upsert({
    where: { sku: "KEY-MX-001" },
    update: {},
    create: {
      name: "Mechanical Keyboard",
      sku: "KEY-MX-001",
      price: "149.00"
    }
  });

  const monitor = await prisma.product.upsert({
    where: { sku: "MON-4K-027" },
    update: {},
    create: {
      name: "27-inch 4K Monitor",
      sku: "MON-4K-027",
      price: "399.00"
    }
  });

  await prisma.stock.upsert({
    where: { productId_warehouseId: { productId: keyboard.id, warehouseId: east.id } },
    update: {},
    create: {
      productId: keyboard.id,
      warehouseId: east.id,
      totalUnits: 4
    }
  });

  await prisma.stock.upsert({
    where: { productId_warehouseId: { productId: keyboard.id, warehouseId: west.id } },
    update: {},
    create: {
      productId: keyboard.id,
      warehouseId: west.id,
      totalUnits: 1
    }
  });

  await prisma.stock.upsert({
    where: { productId_warehouseId: { productId: monitor.id, warehouseId: east.id } },
    update: {},
    create: {
      productId: monitor.id,
      warehouseId: east.id,
      totalUnits: 8
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
