import { JobsView } from '@/src/components/admin/AdminViews';
import { getAdminJobs } from '@/lib/admin/data';

export default async function AdminJobsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; modality?: string; provider?: string; model?: string; range?: string; cursor?: string; seen?: string }>;
}) {
  const filters = await searchParams;
  return <JobsView result={await getAdminJobs(filters)} filters={filters} />;
}
