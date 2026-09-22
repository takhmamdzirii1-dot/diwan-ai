import type { CSSProperties } from 'react';

/** Render official color assets as supplied; theme-tint only the remaining monochrome SVGs. */
export function ModelBrandIcon({ url, name, size = 24 }: { url?: string | null; name: string; size?: number }) {
  if (!url) return <span aria-hidden="true" style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-md border border-[var(--studio-border)] text-[10px] font-semibold text-[var(--studio-text-secondary)]">{name.slice(0, 1)}</span>;
  if (!url.startsWith('/brand/models/') || url.endsWith('-color.svg')) return <img src={url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded object-contain" />;
  const mask = `url("${url}") center / contain no-repeat`;
  return <span aria-hidden="true" style={{ width: size, height: size, mask, WebkitMask: mask } as CSSProperties} className="inline-block shrink-0 bg-[var(--studio-text-primary)]" />;
}
