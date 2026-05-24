import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.reservation.deleteMany();

  const east = await prisma.warehouse.upsert({
    where: { id: "wh_east" },
    update: {
      name: "East Fulfillment",
      location: "Newark, NJ"
    },
    create: {
      id: "wh_east",
      name: "East Fulfillment",
      location: "Newark, NJ"
    }
  });

  const west = await prisma.warehouse.upsert({
    where: { id: "wh_west" },
    update: {
      name: "West Fulfillment",
      location: "Reno, NV"
    },
    create: {
      id: "wh_west",
      name: "West Fulfillment",
      location: "Reno, NV"
    }
  });

  const keyboard = await prisma.product.upsert({
    where: { sku: "KEY-MX-001" },
    update: {
      name: "Mechanical Keyboard",
      price: "149.00"
    },
    create: {
      name: "Mechanical Keyboard",
      sku: "KEY-MX-001",
      price: "149.00"
    }
  });

  const monitor = await prisma.product.upsert({
    where: { sku: "MON-4K-027" },
    update: {
      name: "27-inch 4K Monitor",
      price: "399.00"
    },
    create: {
      name: "27-inch 4K Monitor",
      sku: "MON-4K-027",
      price: "399.00"
    }
  });

  await prisma.stock.upsert({
    where: { productId_warehouseId: { productId: keyboard.id, warehouseId: east.id } },
    update: {
      totalUnits: 4,
      reservedUnits: 0
    },
    create: {
      productId: keyboard.id,
      warehouseId: east.id,
      totalUnits: 4
    }
  });

  await prisma.stock.upsert({
    where: { productId_warehouseId: { productId: keyboard.id, warehouseId: west.id } },
    update: {
      totalUnits: 1,
      reservedUnits: 0
    },
    create: {
      productId: keyboard.id,
      warehouseId: west.id,
      totalUnits: 1
    }
  });

  await prisma.stock.upsert({
    where: { productId_warehouseId: { productId: monitor.id, warehouseId: east.id } },
    update: {
      totalUnits: 8,
      reservedUnits: 0
    },
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
