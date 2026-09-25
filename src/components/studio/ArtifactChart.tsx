'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChartArtifact } from '@/lib/artifacts/core';

export default function ArtifactChart({ artifact, onReady }: { artifact: ChartArtifact; onReady?: (exportPng: () => string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let chart: import('echarts').ECharts | undefined;
    let observer: ResizeObserver | undefined;
    void import('echarts').then((echarts) => {
      if (disposed || !container.current) return;
      chart = echarts.init(container.current, 'dark', { renderer: 'canvas' });
      const pie = artifact.chartType === 'pie' || artifact.chartType === 'donut';
      chart.setOption({
        backgroundColor: 'transparent',
        title: { text: artifact.title, left: artifact.direction === 'rtl' ? 'right' : 'left', textStyle: { color: '#fff', fontSize: 15 } },
        tooltip: { trigger: pie ? 'item' : 'axis' }, legend: { bottom: 0, textStyle: { color: '#aaa' } },
        ...(pie ? {} : { xAxis: { type: 'category', data: artifact.categories }, yAxis: { type: 'value' } }),
        series: artifact.series.map((series) => pie
          ? { name: series.name, type: 'pie', radius: artifact.chartType === 'donut' ? ['38%', '65%'] : '65%', data: artifact.categories.map((name, index) => ({ name, value: series.values[index] ?? 0 })) }
          : { name: series.name, type: artifact.chartType === 'area' ? 'line' : artifact.chartType, areaStyle: artifact.chartType === 'area' ? {} : undefined, data: series.values }),
      });
      onReady?.(() => chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#111111' }) ?? '');
      observer = new ResizeObserver(() => chart?.resize()); observer.observe(container.current);
    }).catch(() => setError(true));
    return () => { disposed = true; observer?.disconnect(); chart?.dispose(); };
  }, [artifact, onReady]);
  return error ? <p role="alert">Chart preview is unavailable.</p> : <div ref={container} role="img" aria-label={artifact.title} className="h-72 w-full" dir={artifact.direction} />;
}
