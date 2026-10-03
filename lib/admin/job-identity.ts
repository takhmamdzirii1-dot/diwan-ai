/** Library results are not additional jobs. Resolve full execution UUIDs even
 * when the canonical execution is outside the current filtered page. */
export async function legacyJobPage(
  readIds: (offset: number, size: number) => Promise<string[]>,
  canonicalIds: (ids: string[]) => Promise<string[]>,
  pageSize = 51,
) {
  const ids: string[] = [];
  let count = 0;
  const batchSize = 100;
  for (let offset = 0; ; offset += batchSize) {
    const batch = await readIds(offset, batchSize);
    if (!batch.length) break;
    const canonical = new Set(await canonicalIds(batch));
    for (const id of batch) if (!canonical.has(id)) { count++; if (ids.length < pageSize) ids.push(id); }
    if (batch.length < batchSize) break;
  }
  return { ids, count };
}

export function jobCursor(value?: string) {
  if (!value) return null;
  const [at, id] = value.split('~');
  if (Number.isNaN(Date.parse(at))) return null;
  return { at: new Date(at).toISOString(), id: id && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? id : null };
}

export function canonicalJobPage<T extends { id: string; source: string; createdAt: string }>(executions: T[], legacy: T[], size = 50) {
  const rows = new Map(legacy.map(row => [row.id, row]));
  for (const row of executions) rows.set(row.id, row);
  const ordered = [...rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const jobs = ordered.slice(0, size);
  const last = jobs.at(-1);
  return { jobs, nextCursor: ordered.length > size && last ? `${last.createdAt}~${last.id}` : null };
}
