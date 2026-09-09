import { OverviewView } from '@/src/components/admin/AdminViews';
import { getAdminOverview } from '@/lib/admin/data';

export default async function AdminOverviewPage() {
  return <OverviewView result={await getAdminOverview()} />;
}
