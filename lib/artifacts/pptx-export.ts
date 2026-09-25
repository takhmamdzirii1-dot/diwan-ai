import type { ChartArtifact, PresentationArtifact } from './core';

const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export async function presentationToPptx(artifact: PresentationArtifact, charts: ChartArtifact[] = []): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtlMode = artifact.direction === 'rtl';
  pptx.title = artifact.title;
  pptx.author = 'VANTRA';
  const rtl = artifact.direction === 'rtl';
  for (const source of artifact.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: '111111' };
    slide.addText(source.title, { x: 0.7, y: 0.55, w: 11.9, h: 0.7, fontSize: 27, bold: true, color: 'FFFFFF', align: rtl ? 'right' : 'left', rtlMode: rtl, breakLine: false });
    if (source.subtitle) slide.addText(source.subtitle, { x: 0.7, y: 1.35, w: 11.9, h: 0.5, fontSize: 18, color: 'BBBBBB', align: rtl ? 'right' : 'left', rtlMode: rtl });
    let y = source.layout === 'title' ? 2.1 : 1.65;
    for (const block of source.blocks) {
      if (block.kind === 'text') {
        slide.addText(block.text, { x: 0.8, y, w: 11.7, h: 0.75, fontSize: 18, color: 'EEEEEE', align: rtl ? 'right' : 'left', rtlMode: rtl, breakLine: false }); y += 0.9;
      } else if (block.kind === 'bullets') {
        for (const item of block.items.slice(0, 8)) { slide.addText(`• ${item}`, { x: 1.0, y, w: 11.1, h: 0.45, fontSize: 17, color: 'EEEEEE', align: rtl ? 'right' : 'left', rtlMode: rtl }); y += 0.55; }
      } else if (block.kind === 'table') {
        const rows = block.rows.slice(0, 10).map((row) => row.slice(0, 8));
        if (rows.length) slide.addTable(rows.map((row) => row.map((text) => ({ text, options: { rtlMode: rtl, align: rtl ? 'right' : 'left' } }))), { x: 0.8, y, w: 11.7, h: Math.min(4.8, rows.length * 0.48), color: 'FFFFFF', fill: { color: '222222' }, border: { color: '555555', pt: 0.5 }, fontSize: 13 });
        y += Math.min(5, rows.length * 0.5);
      } else if (block.kind === 'chart') {
        const chart = charts.find((item) => item.id === block.chartId);
        if (chart) {
          const chartType = chart.chartType === 'donut' ? pptx.ChartType.doughnut : chart.chartType === 'scatter' ? pptx.ChartType.scatter : pptx.ChartType[chart.chartType];
          slide.addChart(chartType, chart.series.map((series) => ({ name: series.name, labels: chart.categories, values: series.values.map((value) => value ?? 0) })),
            { x: 0.8, y, w: 11.7, h: Math.min(4.8, 6.7 - y), showLegend: chart.series.length > 1, showTitle: false, chartColors: ['FFFFFF', 'A3A3A3', '737373'], showValue: false });
          y += 4.9;
        }
      } else if (block.kind === 'image' && /^data:image\/(png|jpeg|webp);base64,/i.test(block.src)) {
        slide.addImage({ data: block.src, x: 0.8, y, w: 11.7, h: Math.min(4.8, 6.7 - y) }); y += 4.9;
      }
    }
    if (source.notes) slide.addNotes(source.notes);
  }
  const result = await pptx.write({ outputType: 'blob', compression: true });
  return result instanceof Blob ? result : new Blob([result as ArrayBuffer], { type: MIME });
}
