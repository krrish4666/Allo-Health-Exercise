const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const envPath = path.join(process.cwd(), ".env");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#][^=]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();

async function main() {
  const [reservationCount, stocks] = await Promise.all([
    prisma.reservation.count(),
    prisma.stock.findMany({
      orderBy: [{ product: { name: "asc" } }, { warehouse: { name: "asc" } }],
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } }
      }
    })
  ]);

  console.log(JSON.stringify({
    reservationCount,
    stocks: stocks.map((stock) => ({
      sku: stock.product.sku,
      product: stock.product.name,
      warehouse: stock.warehouse.name,
      totalUnits: stock.totalUnits,
      reservedUnits: stock.reservedUnits,
      availableUnits: stock.totalUnits - stock.reservedUnits
    }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
