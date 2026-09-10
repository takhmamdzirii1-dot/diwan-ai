import { PaymentsView, PlansPricingView } from '@/src/components/admin/AdminViews';
import { getAdminPaymentPlans, getAdminPayments } from '@/lib/admin/data';

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string }> }) {
  const params = await searchParams;
  if (params.view === 'plans') return <PlansPricingView result={await getAdminPaymentPlans()} />;
  return <PaymentsView result={await getAdminPayments()} initialStatus={params.status} />;
}
