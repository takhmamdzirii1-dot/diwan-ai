import { ProvidersView } from '@/src/components/admin/AdminViews';
import { getAdminProviders } from '@/lib/admin/data';

export default async function AdminProvidersPage() {
  return <ProvidersView result={await getAdminProviders()} />;
}
