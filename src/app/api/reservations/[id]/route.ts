import { fail, ok } from "@/lib/http";
import { getReservation } from "@/server/reservations";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return ok(await getReservation(id));
  } catch (error) {
    return fail(error);
  }
}
