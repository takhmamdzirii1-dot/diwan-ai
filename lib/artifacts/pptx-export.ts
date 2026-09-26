import type { ChartArtifact, PresentationArtifact } from './core';
import { formatPresentationCell, presentationChart, presentationMetricRows, presentationTheme, presentationVariant } from './presentation-design';

const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const color = (value: string) => value.replace('#', '');

export async function presentationToPptx(artifact: PresentationArtifact, charts: ChartArtifact[] = []): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtlMode = artifact.direction === 'rtl';
  pptx.title = artifact.title;
  pptx.author = 'VANTRA';
  const rtl = artifact.direction === 'rtl';
  const theme = presentationTheme(artifact);
  const variantNames = artifact.language.startsWith('ar') ? { cover: 'نظرة عامة', kpi: 'مؤشرات رئيسية', chart: 'اتجاه', table: 'مقاييس', insights: 'أبرز النتائج' }
    : artifact.language.startsWith('fr') ? { cover: 'Vue d’ensemble', kpi: 'Indicateurs clés', chart: 'Tendance', table: 'Mesures', insights: 'Constats' }
      : { cover: 'Overview', kpi: 'Key metrics', chart: 'Trend', table: 'Metrics', insights: 'Insights' };
  for (const [index, source] of artifact.slides.entries()) {
    const variant = presentationVariant(source);
    const slide = pptx.addSlide();
    slide.background = { color: color(theme.canvas) };
    slide.addText(`VANTRA / ${variantNames[variant]}`, { x: 0.75, y: 0.35, w: 10.5, h: 0.2, fontFace: 'Aptos', fontSize: 9, bold: true, charSpacing: 1.5, color: color(theme.muted), align: rtl ? 'right' : 'left', rtlMode: rtl, margin: 0 });
    slide.addText(String(index + 1).padStart(2, '0'), { x: 11.9, y: 0.35, w: 0.65, h: 0.2, fontFace: 'Aptos', fontSize: 9, color: color(theme.muted), align: 'right', margin: 0 });
    slide.addShape(pptx.ShapeType.rect, { x: rtl ? 12.0 : 0.75, y: variant === 'cover' ? 1.9 : 1.08, w: 0.48, h: 0.045, line: { color: color(theme.accent) }, fill: { color: color(theme.accent) } });
    const titleY = variant === 'cover' ? 2.18 : 1.28;
    slide.addText(source.title, { x: 0.75, y: titleY, w: 11.85, h: variant === 'cover' ? 1.28 : 0.72, fontFace: 'Aptos Display', fontSize: variant === 'cover' ? 43 : 30, bold: true, color: color(theme.text), align: rtl ? 'right' : 'left', rtlMode: rtl, margin: 0, breakLine: false });
    if (source.subtitle) slide.addText(source.subtitle, { x: 0.76, y: variant === 'cover' ? 3.56 : 2.04, w: 11.75, h: 0.42, fontFace: 'Aptos', fontSize: variant === 'cover' ? 18 : 14, color: color(theme.muted), align: rtl ? 'right' : 'left', rtlMode: rtl, margin: 0 });
    let y = variant === 'cover' ? 4.25 : source.subtitle ? 2.65 : 2.38;
    for (const block of source.blocks) {
      if (y > 6.45) break;
      if (variant === 'kpi' && block.kind === 'table') {
        const metrics = presentationMetricRows(source);
        const cardWidth = 2.88; const gap = 0.16;
        metrics.forEach((metric, metricIndex) => {
          const x = 0.75 + metricIndex * (cardWidth + gap);
          slide.addShape(pptx.ShapeType.roundRect, { x, y, w: cardWidth, h: 1.6, rectRadius: 0.08, line: { color: color(theme.border), width: 0.7 }, fill: { color: color(theme.surface) } });
          slide.addText(metric.label, { x: x + 0.22, y: y + 0.22, w: cardWidth - 0.44, h: 0.3, fontFace: 'Aptos', fontSize: 12, color: color(theme.muted), margin: 0, align: rtl ? 'right' : 'left', rtlMode: rtl });
          slide.addText(formatPresentationCell(metric.value, artifact.language), { x: x + 0.22, y: y + 0.72, w: cardWidth - 0.44, h: 0.52, fontFace: 'Aptos Display', fontSize: 25, bold: true, color: color(theme.text), margin: 0, align: rtl ? 'right' : 'left', rtlMode: rtl });
        });
        y += 1.85;
      } else if (block.kind === 'text') {
        slide.addText(block.text, { x: 0.8, y, w: 11.7, h: 0.72, fontFace: 'Aptos', fontSize: variant === 'cover' ? 20 : 17, color: color(theme.text), align: rtl ? 'right' : 'left', rtlMode: rtl, margin: 0, breakLine: false }); y += 0.85;
      } else if (block.kind === 'bullets') {
        const items = block.items.slice(0, 6);
        const columns = items.length > 3 ? 2 : 1;
        const cardWidth = columns === 2 ? 5.8 : 11.75;
        items.forEach((item, itemIndex) => {
          const x = 0.75 + (itemIndex % columns) * (cardWidth + 0.18);
          const cardY = y + Math.floor(itemIndex / columns) * 0.82;
          slide.addShape(pptx.ShapeType.roundRect, { x, y: cardY, w: cardWidth, h: 0.68, rectRadius: 0.06, line: { color: color(theme.border), width: 0.6 }, fill: { color: color(theme.surface) } });
          slide.addText(`•  ${item}`, { x: x + 0.18, y: cardY + 0.1, w: cardWidth - 0.36, h: 0.46, fontFace: 'Aptos', fontSize: 15, color: color(theme.text), align: rtl ? 'right' : 'left', rtlMode: rtl, margin: 0.02, breakLine: false });
        });
        y += Math.ceil(items.length / columns) * 0.82;
      } else if (block.kind === 'table') {
        const rows = block.rows.slice(0, 8).map((row, rowIndex) => row.slice(0, 6).map((value, cellIndex) => ({
          text: rowIndex === 0 ? value : formatPresentationCell(value, artifact.language),
          options: { rtlMode: rtl, align: rowIndex > 0 && cellIndex > 0 && /^\s*-?[\d,]+(?:\.\d+)?/.test(value) ? 'right' as const : rtl ? 'right' as const : 'left' as const,
            bold: rowIndex === 0 || cellIndex === 0, color: color(rowIndex === 0 ? theme.text : cellIndex === 0 ? theme.text : theme.muted),
            fill: { color: color(rowIndex === 0 ? theme.surfaceAlt : rowIndex % 2 === 0 ? theme.surface : theme.canvas) } },
        })));
        if (rows.length) slide.addTable(rows, { x: 0.75, y, w: 11.85, h: Math.min(4.1, rows.length * 0.48), border: { color: color(theme.border), pt: 0.5 }, fontFace: 'Aptos', fontSize: 13, margin: 0.12, valign: 'middle' });
        y += Math.min(4.2, rows.length * 0.5);
      } else if (block.kind === 'chart') {
        const found = charts.find((item) => item.id === block.chartId);
        if (found) {
          const chart = presentationChart(found);
          const chartType = chart.chartType === 'donut' ? pptx.ChartType.doughnut : chart.chartType === 'scatter' ? pptx.ChartType.scatter : pptx.ChartType[chart.chartType];
          slide.addChart(chartType, chart.series.map((series) => ({ name: series.name, labels: chart.categories, values: series.values.map((value) => value ?? 0) })),
            { x: 0.75, y, w: 11.85, h: Math.min(3.9, 6.7 - y), showLegend: chart.series.length > 1, legendPos: 'b', showTitle: false, chartColors: theme.chart.map(color), showValue: false });
          if (found.categories.length > 12 || found.series.length > 4) {
            const note = artifact.language.startsWith('ar') ? 'تُعرض أول 12 فئة وما يصل إلى 4 سلاسل.' : artifact.language.startsWith('fr')
              ? 'Affichage des 12 premières catégories et de 4 séries maximum.' : 'Showing the first 12 categories and up to 4 series.';
            slide.addText(note, { x: 0.8, y: Math.min(6.75, y + 3.85), w: 11.7, h: 0.2, fontFace: 'Aptos', fontSize: 9, color: color(theme.muted), align: rtl ? 'right' : 'left', rtlMode: rtl, margin: 0 });
          }
          y += 4.0;
        }
      } else if (block.kind === 'image' && /^data:image\/(png|jpeg|webp);base64,/i.test(block.src)) {
        slide.addImage({ data: block.src, x: 0.8, y, w: 11.7, h: Math.min(4.0, 6.7 - y) }); y += 4.1;
      }
    }
    slide.addText(`VANTRA  /  ${String(index + 1).padStart(2, '0')} — ${String(artifact.slides.length).padStart(2, '0')}`, { x: 0.75, y: 7.08, w: 11.85, h: 0.18, fontFace: 'Aptos', fontSize: 8, charSpacing: 1, color: color(theme.muted), align: rtl ? 'right' : 'left', rtlMode: rtl, margin: 0 });
    if (source.notes) slide.addNotes(source.notes);
  }
  const result = await pptx.write({ outputType: 'blob', compression: true });
  return result instanceof Blob ? result : new Blob([result as ArrayBuffer], { type: MIME });
}
