import { fail, ok } from "@/lib/http";
import { unauthorized } from "@/lib/errors";
import { cleanupExpiredReservations } from "@/server/reservations";

export async function POST(request: Request) {
  try {
    const token = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (!token || authHeader !== `Bearer ${token}`) {
      throw unauthorized("Missing or invalid cleanup token.");
    }

    return ok(await cleanupExpiredReservations());
  } catch (error) {
    return fail(error);
  }
}
