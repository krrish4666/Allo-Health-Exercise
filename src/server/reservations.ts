import { Prisma, ReservationStatus, type Reservation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { conflict, gone, notFound } from "@/lib/errors";
import type { ReservationCreateInput } from "@/lib/validation";

const HOLD_MINUTES = 10;

type LockedStockRow = {
  id: string;
  productId: string;
  warehouseId: string;
  totalUnits: number;
  reservedUnits: number;
};

type LockedReservationRow = Reservation & {
  stock: LockedStockRow;
};

export async function lockStockForReservation(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string
) {
  const rows = await tx.$queryRaw<LockedStockRow[]>`
    SELECT id, "productId", "warehouseId", "totalUnits", "reservedUnits"
    FROM "Stock"
    WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
    FOR UPDATE
  `;

  return rows[0] ?? null;
}

async function releaseExpiredReservationsForLockedStock(tx: Prisma.TransactionClient, stockId: string) {
  const expired = await tx.reservation.findMany({
    where: {
      stockId,
      status: ReservationStatus.PENDING,
      expiresAt: { lt: new Date() }
    },
    select: { id: true, quantity: true }
  });

  if (expired.length === 0) {
    return;
  }

  const releaseQuantity = expired.reduce((sum, reservation) => sum + reservation.quantity, 0);

  await tx.reservation.updateMany({
    where: { id: { in: expired.map((reservation) => reservation.id) } },
    data: { status: ReservationStatus.RELEASED }
  });

  await tx.stock.update({
    where: { id: stockId },
    data: { reservedUnits: { decrement: releaseQuantity } }
  });
}

export async function createReservation(input: ReservationCreateInput) {
  return prisma.$transaction(async (tx) => {
    const stock = await lockStockForReservation(tx, input.productId, input.warehouseId);

    if (!stock) {
      throw notFound("Stock record was not found for the selected product and warehouse.");
    }

    await releaseExpiredReservationsForLockedStock(tx, stock.id);

    const refreshedStock = await tx.stock.findUniqueOrThrow({
      where: { id: stock.id },
      select: { id: true, totalUnits: true, reservedUnits: true }
    });
    const availableUnits = refreshedStock.totalUnits - refreshedStock.reservedUnits;

    if (availableUnits < input.quantity) {
      throw conflict(`Only ${availableUnits} unit(s) are currently available.`);
    }

    await tx.stock.update({
      where: { id: stock.id },
      data: { reservedUnits: { increment: input.quantity } }
    });

    return tx.reservation.create({
      data: {
        stockId: stock.id,
        quantity: input.quantity,
        expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000)
      },
      include: {
        stock: {
          include: {
            product: true,
            warehouse: true
          }
        }
      }
    });
  });
}

async function lockReservationWithStock(tx: Prisma.TransactionClient, reservationId: string) {
  const rows = await tx.$queryRaw<LockedReservationRow[]>`
    SELECT r.*, row_to_json(s.*) AS stock
    FROM "Reservation" r
    JOIN "Stock" s ON s.id = r."stockId"
    WHERE r.id = ${reservationId}
    FOR UPDATE OF r, s
  `;

  return rows[0] ?? null;
}

export async function confirmReservation(reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await lockReservationWithStock(tx, reservationId);

    if (!reservation) {
      throw notFound("Reservation was not found.");
    }

    if (reservation.status === ReservationStatus.CONFIRMED) {
      return tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: { stock: { include: { product: true, warehouse: true } } }
      });
    }

    if (reservation.status === ReservationStatus.RELEASED) {
      throw gone("Reservation has already been released.");
    }

    if (reservation.expiresAt < new Date()) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.RELEASED }
      });
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: { reservedUnits: { decrement: reservation.quantity } }
      });
      throw gone("Reservation has expired.");
    }

    await tx.stock.update({
      where: { id: reservation.stockId },
      data: {
        totalUnits: { decrement: reservation.quantity },
        reservedUnits: { decrement: reservation.quantity }
      }
    });

    return tx.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CONFIRMED },
      include: { stock: { include: { product: true, warehouse: true } } }
    });
  });
}

export async function releaseReservation(reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await lockReservationWithStock(tx, reservationId);

    if (!reservation) {
      throw notFound("Reservation was not found.");
    }

    if (reservation.status === ReservationStatus.RELEASED) {
      return tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: { stock: { include: { product: true, warehouse: true } } }
      });
    }

    if (reservation.status === ReservationStatus.CONFIRMED) {
      throw conflict("Confirmed reservations cannot be released.");
    }

    await tx.stock.update({
      where: { id: reservation.stockId },
      data: { reservedUnits: { decrement: reservation.quantity } }
    });

    return tx.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.RELEASED },
      include: { stock: { include: { product: true, warehouse: true } } }
    });
  });
}

export async function cleanupExpiredReservations() {
  return prisma.$transaction(async (tx) => {
    const expired = await tx.$queryRaw<Array<{ id: string; stockId: string; quantity: number }>>`
      SELECT id, "stockId", quantity
      FROM "Reservation"
      WHERE status = 'PENDING'::"ReservationStatus" AND "expiresAt" < now()
      FOR UPDATE
    `;

    if (expired.length === 0) {
      return { releasedReservations: 0, releasedUnits: 0 };
    }

    const releasedUnitsByStock = expired.reduce<Record<string, number>>((acc, reservation) => {
      acc[reservation.stockId] = (acc[reservation.stockId] ?? 0) + reservation.quantity;
      return acc;
    }, {});

    await tx.reservation.updateMany({
      where: { id: { in: expired.map((reservation) => reservation.id) } },
      data: { status: ReservationStatus.RELEASED }
    });

    for (const [stockId, quantity] of Object.entries(releasedUnitsByStock)) {
      await tx.stock.update({
        where: { id: stockId },
        data: { reservedUnits: { decrement: quantity } }
      });
    }

    return {
      releasedReservations: expired.length,
      releasedUnits: expired.reduce((sum, reservation) => sum + reservation.quantity, 0)
    };
  });
}

export async function getReservation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      stock: {
        include: {
          product: true,
          warehouse: true
        }
      }
    }
  });

  if (!reservation) {
    throw notFound("Reservation was not found.");
  }

  return reservation;
}
