import { AuditView } from '@/src/components/admin/AdminViews';
import { getAdminAudit } from '@/lib/admin/data';

export default async function AdminAuditPage() {
  return <AuditView result={await getAdminAudit()} />;
}
