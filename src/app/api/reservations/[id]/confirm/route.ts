import { errorResponse } from "@/lib/http";
import { withIdempotency } from "@/lib/idempotency";
import { confirmReservation } from "@/server/reservations";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  return withIdempotency(request, `confirm:${id}`, async () => {
    try {
      const reservation = await confirmReservation(id);

      return {
        status: 200,
        body: { ok: true, data: reservation }
      };
    } catch (error) {
      return errorResponse(error);
    }
  });
}
