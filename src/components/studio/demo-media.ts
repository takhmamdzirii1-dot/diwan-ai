'use client';

export const DEMO_LIBRARY_KEY = 'vantra_demo_media_v1';
export const DEMO_LIBRARY_EVENT = 'vantra-demo-library-change';

export type DemoMediaKind = 'image' | 'video';
export type DemoMediaItem = {
  id: string;
  kind: DemoMediaKind;
  prompt: string;
  model: string;
  assetUrl: string;
  createdAt: number;
  demo: true;
  aspectRatio: string;
};

const ASSETS: Record<DemoMediaKind, string> = {
  image: '/showcase/image-preview.png',
  video: '/showcase/video-preview.png',
};

export function readDemoLibrary(): DemoMediaItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(DEMO_LIBRARY_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item?.demo === true) : [];
  } catch {
    throw new Error('demo-library-read');
  }
}

export function writeDemoLibrary(items: DemoMediaItem[]) {
  localStorage.setItem(DEMO_LIBRARY_KEY, JSON.stringify(items.slice(0, 60)));
  window.dispatchEvent(new Event(DEMO_LIBRARY_EVENT));
}

export function addDemoMedia(input: Omit<DemoMediaItem, 'id' | 'assetUrl' | 'createdAt' | 'demo'>) {
  const item: DemoMediaItem = {
    ...input,
    id: `demo-${input.kind}-${crypto.randomUUID()}`,
    assetUrl: ASSETS[input.kind],
    createdAt: Date.now(),
    demo: true,
  };
  writeDemoLibrary([item, ...readDemoLibrary()]);
  return item;
}

export async function runDemoGeneration(onProgress: (progress: number) => void, shouldFail = false) {
  for (const progress of [18, 46, 74, 100]) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    onProgress(progress);
    if (shouldFail && progress === 46) throw new Error('demo-generation-failed');
  }
}

export async function downloadDemoMedia(item: DemoMediaItem) {
  const response = await fetch(item.assetUrl);
  if (!response.ok) throw new Error('demo-download');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `vantra-${item.kind}-demo.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
