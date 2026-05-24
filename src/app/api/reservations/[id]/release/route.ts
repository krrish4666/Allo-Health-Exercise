import { fail, ok } from "@/lib/http";
import { releaseReservation } from "@/server/reservations";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return ok(await releaseReservation(id));
  } catch (error) {
    return fail(error);
  }
}
