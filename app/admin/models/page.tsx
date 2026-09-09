import { ModelsView } from '@/src/components/admin/AdminViews';
import { getAdminModels } from '@/lib/admin/data';

export default async function AdminModelsPage() {
  return <ModelsView result={await getAdminModels()} />;
}
