import { notFound } from 'next/navigation';

const WORKSPACES = ['chat', 'image', 'video', 'library'] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return WORKSPACES.map((workspace) => ({ workspace }));
}

export default async function StudioWorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (!WORKSPACES.includes(workspace as (typeof WORKSPACES)[number])) notFound();
  return null;
}
