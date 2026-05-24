import { errorResponse, parseJson } from "@/lib/http";
import { withIdempotency } from "@/lib/idempotency";
import { reservationCreateSchema } from "@/lib/validation";
import { createReservation } from "@/server/reservations";

export async function POST(request: Request) {
  return withIdempotency(request, "reserve", async () => {
    try {
      const input = reservationCreateSchema.parse(await parseJson(request));
      const reservation = await createReservation(input);

      return {
        status: 200,
        body: { ok: true, data: reservation }
      };
    } catch (error) {
      return errorResponse(error);
    }
  });
}
