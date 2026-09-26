import type { ArtifactSlide, ChartArtifact, PresentationArtifact, PresentationSlideVariant } from './core';

export type PresentationThemeId = 'executive-dark' | 'executive-light' | 'visual-marketing';
type Palette = {
  canvas: string; surface: string; surfaceAlt: string; border: string;
  text: string; muted: string; accent: string; chart: readonly string[];
};

// Only known themes can reach preview/export; artifact metadata is never used as CSS.
export const presentationThemes: Record<PresentationThemeId, Palette> = {
  'executive-dark': {
    canvas: '#101214', surface: '#1A1D20', surfaceAlt: '#22262A', border: '#343A40',
    text: '#F4F5F3', muted: '#AAB2B7', accent: '#B8C9B8', chart: ['#B8C9B8', '#A4ACB5', '#7B858E', '#D4D8D9'],
  },
  'executive-light': {
    canvas: '#F6F6F3', surface: '#FFFFFF', surfaceAlt: '#ECEDEA', border: '#D5D9D6',
    text: '#202522', muted: '#58615B', accent: '#566E5E', chart: ['#566E5E', '#798892', '#A3ABA8', '#4E5853'],
  },
  'visual-marketing': {
    canvas: '#17191B', surface: '#23272A', surfaceAlt: '#2D3235', border: '#40474A',
    text: '#F8F7F3', muted: '#BDC2C1', accent: '#C7B393', chart: ['#C7B393', '#9BAAA8', '#7B858C', '#D5D0C6'],
  },
};

export function presentationTheme(artifact: PresentationArtifact): Palette {
  const requested = artifact.metadata?.presentationTheme;
  return typeof requested === 'string' && Object.hasOwn(presentationThemes, requested)
    ? presentationThemes[requested as PresentationThemeId]
    : presentationThemes['executive-dark'];
}

export function presentationVariant(slide: ArtifactSlide): PresentationSlideVariant {
  if (slide.variant) return slide.variant;
  if (slide.layout === 'title') return 'cover';
  if (slide.blocks.some((block) => block.kind === 'chart')) return 'chart';
  if (slide.blocks.some((block) => block.kind === 'table')) return 'table';
  return 'insights';
}

export function presentationMetricRows(slide: ArtifactSlide): { label: string; value: string }[] {
  const table = slide.blocks.find((block) => block.kind === 'table');
  if (!table || table.kind !== 'table') return [];
  const rows = table.rows.filter((row) => row.length >= 2);
  const start = rows.length > 1 && /^(metric|indicator|kpi|mesure|indicateur|مؤشر)/i.test(rows[0][0].trim()) ? 1 : 0;
  return rows.slice(start, start + 4).map((row) => ({ label: row[0], value: row[1] }));
}

export function presentationChart(chart: ChartArtifact): ChartArtifact {
  return { ...chart, categories: chart.categories.slice(0, 12),
    series: chart.series.slice(0, 4).map((series) => ({ ...series, values: series.values.slice(0, 12) })) };
}

export function formatPresentationCell(value: string, locale: string): string {
  const trimmed = value.trim();
  const match = /^([€$£دج]?\s*)(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?)(\s*%|\s*[€$£]|\s*DA|\s*DZD)?$/i.exec(trimmed);
  if (!match) return value;
  const number = Number(match[2].replaceAll(',', ''));
  if (!Number.isFinite(number)) return value;
  const language = /^(en|fr|ar)(-|$)/i.test(locale) ? locale : 'en';
  return `${match[1]}${new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(number)}${match[3] ?? ''}`.trim();
}
