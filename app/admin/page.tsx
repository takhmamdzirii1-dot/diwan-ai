import AdminOverview from '@/src/components/admin/AdminOverview';
import { getAdminOverview } from '@/lib/admin/data';

export default async function AdminOverviewPage() {
  return <AdminOverview result={await getAdminOverview()} />;
}
