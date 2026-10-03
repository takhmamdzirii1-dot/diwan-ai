import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';

const bundle = buildSync({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React,{useState,useCallback} from 'react'; import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl';
import ImageCanvas from './src/components/studio/ImageCanvas'; import VideoCanvas from './src/components/studio/PrunaMotionStudio';
import Recovery from './src/components/studio/MediaRecoveryNotice';
import en from './messages/studio-en.json'; import fr from './messages/studio-fr.json'; import ar from './messages/studio-ar.json';
const kind=window.fixtureKind,locale=window.fixtureLocale;
const model={id:'fixture-model',displayName:'Fixture Model',provider:'VANTRA',modality:kind,enabled:true,availability:'available',planAccessible:true,verifiedCreditCost:15,displayOrder:1,supportedControls:[],verifiedCapabilities:[],capabilities:kind==='image'?{textToImage:true,referenceImage:false,aspectRatios:['1:1','9:16'],maxOutputs:1,negativePrompt:false}:{textToVideo:true,imageToVideo:true,durations:[5,10],aspectRatios:['16:9','9:16'],resolutions:['480p','768p'],generationModes:['speed','quality'],cameraMotions:[],generatedAudio:false,negativePrompt:false}};
function Harness(){const [recovery,setRecovery]=useState(),[mounted,setMounted]=useState(true);const receive=useCallback(s=>setRecovery(s),[]),refresh=useCallback(async()=>{},[]);window.fixtureRemount=()=>{setMounted(false);setTimeout(()=>setMounted(true),20)};
const generate=async draft=>{window.fixtureGenerateCount=(window.fixtureGenerateCount||0)+1;if(window.fixtureFailNext){window.fixtureFailNext=false;throw Error('PROVIDER_QUOTA_EXHAUSTED')}return {src:'/fixture-image.svg',mimeType:'image/svg+xml',creditsCharged:15,libraryAssetId:'fixture-result-'+window.fixtureGenerateCount}};
return <><Recovery userId='fixture-owner' locale={locale} refreshBalance={refresh} onOpenLibrary={()=>{}} onStatus={receive}/>{mounted&&React.createElement(kind==='image'?ImageCanvas:VideoCanvas,{models:[model],recovery,onGenerate:generate,planCode:'pro'})}</>}
createRoot(document.getElementById('fixture')).render(<NextIntlClientProvider locale={locale} messages={{en,fr,ar}[locale]} timeZone='UTC'><Harness/></NextIntlClientProvider>);
` }, bundle: true, write: false, platform: 'browser', tsconfig: 'tsconfig.json', define: {
  'process.env': '{}', 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"https://fixture.supabase.co"', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"fixture-public-key"',
} }).outputFiles[0].text;

async function fixture(page: import('@playwright/test').Page, kind: string, locale: string, theme: string) {
  await page.route('https://fixture.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.route('**/fixture-image.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="gray"/></svg>' }));
  await page.goto('/en');
  await page.evaluate(({ kind, locale, theme }) => {
    Object.assign(window, { fixtureKind: kind, fixtureLocale: locale });
    document.body.innerHTML = '<div class="studio-overlay-root studio-shell" style="height:100dvh"><div id="fixture" style="height:100%"></div></div>';
    (document.querySelector('.studio-overlay-root') as HTMLElement).dataset.studioTheme = theme;
    document.getElementById('fixture')!.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, { kind, locale, theme });
  await page.addScriptTag({ content: bundle });
}

test('@media-recovery Image generates consecutively, recovers after failure, and enlarges with keyboard/mobile modal behavior', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/generate/media/status**', route => route.fulfill({ json: { executions: [] } }));
  await fixture(page, 'image', 'en', 'neutral');
  await page.locator('textarea').fill('A fixture image');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter fullscreen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => { Object.assign(window, { fixtureFailNext: true }); });
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.locator('#fixture [role="alert"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.locator('#fixture [role="alert"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { fixtureGenerateCount: number }).fixtureGenerateCount)).toBe(3);
});

for (const kind of ['image', 'video']) for (const [locale, theme, width] of [['en','neutral',1440],['ar','oled',390],['fr','warm',360]] as const) {
  test(`@media-recovery ${kind} ${locale} ${theme}: reload/navigation reattaches to active operation and delivers to canvas without POST`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let completed = false; let posts = 0;
    const id = '00000000-0000-0000-0000-000000000001';
    await page.route('**/api/generate/**', route => {
      if (route.request().method() === 'POST') posts++;
      const status = { executionId: id, modality: kind, state: completed ? 'completed' : 'processing', creditsCharged: completed ? 15 : 0, creditsReleased: false, timeout: false, retryAfterMs: 5000,
        context: { prompt: 'Recovered owned prompt', modelId: 'fixture-model', aspectRatio: '9:16', duration: 5, resolution: '480p', mode: 'speed', sourceMode: 'text' },
        ...(completed ? { result: { src: '/fixture-image.svg', mimeType: kind === 'image' ? 'image/svg+xml' : 'video/mp4', libraryAssetId: id } } : {}) };
      return route.fulfill({ json: route.request().url().includes('operationId=') || route.request().url().includes('executionId=') ? status : { executions: [status] } });
    });
    await fixture(page, kind, locale, theme);
    await expect(page.locator('textarea').first()).toHaveValue('Recovered owned prompt');
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
    await expect(page.locator('form')).not.toContainText('temporarily unavailable');
    await page.evaluate(id => localStorage.setItem('vantra:media-operation:fixture-owner:' + (window as unknown as {fixtureKind:string}).fixtureKind, id), id);
    // Reload before completion: the operation ID is resolved, not submitted.
    await fixture(page, kind, locale, theme);
    await expect(page.locator('textarea').first()).toHaveValue('Recovered owned prompt');
    await page.evaluate(() => (window as unknown as { fixtureRemount: () => void }).fixtureRemount());
    await expect(page.locator('textarea').first()).toHaveValue('Recovered owned prompt');
    completed = true;
    const media = kind === 'image' ? page.locator('img[alt="Generated image"], img[alt="Image générée"], img[alt="الصورة المُنشأة"], img[src="/fixture-image.svg"]').first() : page.locator('video').first();
    await expect(media).toBeVisible({ timeout: 22000 });
    await expect(media).toHaveAttribute('src', '/fixture-image.svg');
    expect(posts).toBe(0);
    // A terminal operation that finished while away also restores immediately.
    await fixture(page, kind, locale, theme);
    await expect(kind === 'image' ? page.locator('img[src="/fixture-image.svg"]').first() : page.locator('video').first()).toBeVisible();
    expect(posts).toBe(0);
  });
}
