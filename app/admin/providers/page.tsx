import { ProvidersView } from '@/src/components/admin/AdminViews';
import { getAdminProviders } from '@/lib/admin/data';
import AdminSearchProviders from '@/src/components/admin/AdminSearchProviders';

export default async function AdminProvidersPage() {
  return <><ProvidersView result={await getAdminProviders()} /><AdminSearchProviders /></>;
}
