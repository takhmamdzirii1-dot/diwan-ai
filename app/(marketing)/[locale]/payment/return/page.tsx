import PaymentReturnStatus from '@/src/components/payments/PaymentReturnStatus';

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string | string[] }>;
}) {
  const { orderId } = await searchParams;
  const validId = typeof orderId === 'string' && /^[0-9a-f-]{36}$/i.test(orderId) ? orderId : null;
  return <PaymentReturnStatus orderId={validId} />;
}
