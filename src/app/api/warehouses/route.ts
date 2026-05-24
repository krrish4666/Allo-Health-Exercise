import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: "asc" }
    });

    return ok(warehouses);
  } catch (error) {
    return fail(error);
  }
}
