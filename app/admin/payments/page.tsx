import { PaymentsView } from '@/src/components/admin/AdminViews';
import { getAdminPaymentPlans, getAdminPayments } from '@/lib/admin/data';

export default async function AdminPaymentsPage() {
  const [plans, payments] = await Promise.all([getAdminPaymentPlans(), getAdminPayments()]);
  return <PaymentsView plans={plans} result={payments} />;
}
