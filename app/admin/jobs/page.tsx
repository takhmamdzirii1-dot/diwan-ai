import { JobsView } from '@/src/components/admin/AdminViews';
import { getAdminJobs } from '@/lib/admin/data';

export default async function AdminJobsPage() {
  return <JobsView result={await getAdminJobs()} />;
}
