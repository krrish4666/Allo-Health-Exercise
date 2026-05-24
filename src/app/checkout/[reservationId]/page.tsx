import { CheckoutClient } from "@/components/checkout-client";

type PageProps = {
  params: Promise<{ reservationId: string }>;
};

export default async function CheckoutPage({ params }: PageProps) {
  const { reservationId } = await params;

  return <CheckoutClient reservationId={reservationId} />;
}
