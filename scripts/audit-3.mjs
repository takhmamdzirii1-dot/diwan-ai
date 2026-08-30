import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const errors = [];
p.on('pageerror', e => errors.push('[pageerror] ' + String(e).slice(0, 100)));
const BASE = 'https://ai-alpha-delta-six.vercel.app';
const out = {};

await p.goto(BASE + '/studio', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 3500));

// go to Image Canvas with retry
for (let i = 0; i < 3; i++) {
  await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
  await new Promise(r => setTimeout(r, 1500));
  const ok = await p.evaluate(() => !!document.querySelector('button[aria-label="Generate"]') || [...document.querySelectorAll('button')].some(b => /Flux\.1 Pro ·/.test(b.textContent)));
  if (ok) break;
}

// open config popover with real mouse click + retry
const pill = await p.$('button[aria-expanded]');
if (pill) { await pill.click(); await new Promise(r => setTimeout(r, 800)); }
out.popoverOpen = await p.evaluate(() => !!document.querySelector('[role="dialog"][aria-label="Image generation settings"]'));

if (out.popoverOpen) {
  await p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-label="Image generation settings"]'); [...d.querySelectorAll('button')].find(b => b.textContent.trim() === '16:9')?.click(); });
  await new Promise(r => setTimeout(r, 700));
  await p.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));
}
out.frame169 = await p.evaluate(() => !![...document.querySelectorAll('div')].find(d => d.className.includes('aspect-video')));

// generate via liquid button
const before = await p.evaluate(() => document.querySelectorAll('aside[aria-label="Session image history"] button').length);
await p.evaluate(() => { const ta = document.querySelector('textarea[placeholder*="imaginative"]'); if (ta) { ta.value = 'Golden hour over Algiers'; ta.dispatchEvent(new Event('input', { bubbles: true })); } });
await new Promise(r => setTimeout(r, 300));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.querySelector('.shader-container-exploded'))?.click());
await new Promise(r => setTimeout(r, 4500));
out.image = {
  resultShown: await p.evaluate(() => document.body.innerText.includes('Your render is ready') || !!document.querySelector('img[alt="Generated"]')),
  filmstripBefore: before,
  filmstripAfter: await p.evaluate(() => document.querySelectorAll('aside[aria-label="Session image history"] button').length),
};

// MOTION STUDIO
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Motion Studio')?.click());
await new Promise(r => setTimeout(r, 1200));
out.motion = await p.evaluate(() => ({
  pill: [...document.querySelectorAll('button')].some(b => /Kling AI 1\.5 · 5s/.test(b.textContent)),
  cameraSelect: !!document.querySelector('select[aria-label="Camera motion"]'),
  cost: document.body.innerText.includes('240 pts'),
}));

// LIBRARY
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Library')?.click());
await new Promise(r => setTimeout(r, 1200));
out.library = await p.evaluate(() => ({
  filters: [...document.querySelectorAll('button[aria-pressed]')].map(b => b.textContent.trim()),
  cards: document.querySelectorAll('img[alt]').length,
  playIcons: document.querySelectorAll('svg.lucide-play').length,
}));

// SETTINGS
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Settings')?.click());
await new Promise(r => setTimeout(r, 900));
out.settings = await p.evaluate(() => ({
  tabs: [...document.querySelectorAll('[role="dialog"] button')].map(b => b.textContent.trim()).filter(t => ['Profile & General','AI Behavior','Billing & Plans','Data & Privacy'].includes(t)).length,
  open: !!document.querySelector('[role="dialog"][aria-label="Settings"]'),
}));

console.log(JSON.stringify({ out, errors: errors.slice(0, 8) }, null, 2));
await b.close();
