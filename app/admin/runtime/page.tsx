import { RuntimeLimitsView } from '@/src/components/admin/AdminViews';
import { getAdminProviders } from '@/lib/admin/data';

export default async function AdminRuntimePage() {
  return <RuntimeLimitsView result={await getAdminProviders()} />;
}
