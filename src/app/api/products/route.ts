import { ReservationStatus } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        stocks: {
          include: { warehouse: true },
          orderBy: { warehouse: { name: "asc" } }
        }
      }
    });

    const stockIds = products.flatMap((product) => product.stocks.map((stock) => stock.id));
    const activePendingReservations =
      stockIds.length === 0
        ? []
        : await prisma.reservation.groupBy({
            by: ["stockId"],
            where: {
              stockId: { in: stockIds },
              status: ReservationStatus.PENDING,
              expiresAt: { gt: new Date() }
            },
            _sum: { quantity: true }
          });

    const activeReservedByStock = new Map(
      activePendingReservations.map((reservation) => [
        reservation.stockId,
        reservation._sum.quantity ?? 0
      ])
    );

    return ok(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price.toString(),
        warehouses: product.stocks.map((stock) => {
          const activeReservedUnits = activeReservedByStock.get(stock.id) ?? 0;

          return {
            stockId: stock.id,
            warehouseId: stock.warehouseId,
            warehouseName: stock.warehouse.name,
            location: stock.warehouse.location,
            totalUnits: stock.totalUnits,
            reservedUnits: activeReservedUnits,
            availableUnits: Math.max(stock.totalUnits - activeReservedUnits, 0)
          };
        })
      }))
    );
  } catch (error) {
    return fail(error);
  }
}
