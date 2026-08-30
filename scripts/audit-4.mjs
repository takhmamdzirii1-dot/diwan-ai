import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const BASE = 'https://ai-alpha-delta-six.vercel.app';
await p.goto(BASE + '/studio', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 5000)); // full hydration

const out = {};
// IMAGE CANVAS
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 2000));
out.imageNav = await p.evaluate(() => !!document.querySelector('button[aria-label="Generate"], .shader-container-exploded') || [...document.querySelectorAll('button')].some(b => /Flux\.1 Pro ·/.test(b.textContent)));

// open popover via evaluate click on the pill (matches text pattern)
for (let i = 0; i < 2; i++) {
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Flux\.1 Pro ·/.test(b.textContent) || /Flux Realism ·/.test(b.textContent))?.click());
  await new Promise(r => setTimeout(r, 900));
  const open = await p.evaluate(() => !!document.querySelector('[role="dialog"][aria-label="Image generation settings"]'));
  if (open) break;
}
out.popoverOpen = await p.evaluate(() => !!document.querySelector('[role="dialog"][aria-label="Image generation settings"]'));
if (out.popoverOpen) {
  await p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-label="Image generation settings"]'); [...d.querySelectorAll('button')].find(b => b.textContent.trim() === '16:9')?.click(); });
  await new Promise(r => setTimeout(r, 800));
  await p.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));
}
out.frame169 = await p.evaluate(() => !![...document.querySelectorAll('div')].find(d => typeof d.className === 'string' && d.className.includes('aspect-video')));

// generate
await p.evaluate(() => { const ta = document.querySelector('textarea[placeholder*="imaginative"]'); if (ta) { ta.value = 'Golden hour over Algiers'; ta.dispatchEvent(new Event('input', { bubbles: true })); } });
await new Promise(r => setTimeout(r, 300));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.querySelector('.shader-container-exploded'))?.click());
await new Promise(r => setTimeout(r, 4500));
out.image = {
  result: await p.evaluate(() => !!document.querySelector('img[alt="Generated"]')),
  filmstrip: await p.evaluate(() => document.querySelectorAll('aside[aria-label="Session image history"] button').length),
};

// MOTION
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Motion Studio')?.click());
await new Promise(r => setTimeout(r, 1500));
out.motion = await p.evaluate(() => ({
  pill: [...document.querySelectorAll('button')].some(b => /Kling AI 1\.5 · 5s/.test(b.textContent)),
  camera: !!document.querySelector('select[aria-label="Camera motion"]'),
  cost: document.body.innerText.includes('240 pts'),
}));

// LIBRARY
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Library')?.click());
await new Promise(r => setTimeout(r, 1400));
out.library = await p.evaluate(() => ({
  filters: [...document.querySelectorAll('button[aria-pressed]')].map(b => b.textContent.trim()),
  images: document.querySelectorAll('img[alt]').length,
}));

// SETTINGS
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Settings')?.click());
await new Promise(r => setTimeout(r, 1000));
out.settings = await p.evaluate(() => ({
  open: !!document.querySelector('[role="dialog"][aria-label="Settings"]'),
  tabs: [...document.querySelectorAll('[role="dialog"] button')].filter(b => /Profile & General|AI Behavior|Billing|Data & Privacy/.test(b.textContent)).length,
}));

console.log(JSON.stringify(out, null, 2));
await b.close();
