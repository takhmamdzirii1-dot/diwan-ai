import { UsersView } from '@/src/components/admin/AdminViews';
import { getAdminUsers } from '@/lib/admin/data';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  return <UsersView result={await getAdminUsers(q.slice(0, 200))} />;
}
