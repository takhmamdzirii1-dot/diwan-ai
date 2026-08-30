import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const errors = [];
p.on('pageerror', e => errors.push('[pageerror] ' + String(e).slice(0, 100)));
p.on('requestfailed', r => errors.push('[reqfail] ' + r.url().slice(0, 70)));
const BASE = 'https://ai-alpha-delta-six.vercel.app';
const out = {};

// IMAGE CANVAS — full generate flow
await p.goto(BASE + '/studio', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 2500));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 1200));
out.image = await p.evaluate(() => ({
  refBtn: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '+ Ref'),
  advancedBtn: !!document.querySelector('button[aria-expanded][aria-controls]') || [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Advanced'),
  filmstrip: !!document.querySelector('aside[aria-label="Session image history"]'),
  filmstripCount: document.querySelectorAll('aside[aria-label="Session image history"] button').length,
}));
// switch ratio to 16:9 and verify frame class changes
await p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-label="Image generation settings"]'); });
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Flux\.1 Pro ·/.test(b.textContent))?.click());
await new Promise(r => setTimeout(r, 600));
await p.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-label="Image generation settings"]'); [...d.querySelectorAll('button')].find(b => b.textContent.trim() === '16:9')?.click(); });
await new Promise(r => setTimeout(r, 700));
await p.keyboard.press('Escape');
out.image.frameAfter169 = await p.evaluate(() => { const f = [...document.querySelectorAll('div')].find(d => d.className.includes('aspect-video')); return !!f; });
// generate (mock provider) — prompt + generate
await p.evaluate(() => { const ta = document.querySelector('textarea[placeholder*="imaginative"]'); if (ta) { ta.value = 'Golden hour over Algiers'; ta.dispatchEvent(new Event('input', { bubbles: true })); } });
await new Promise(r => setTimeout(r, 300));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.querySelector('.shader-container-exploded'))?.click());
await new Promise(r => setTimeout(r, 4000));
out.image.resultShown = await p.evaluate(() => document.body.innerText.includes('Your render is ready') || !!document.querySelector('img[alt="Generated"]'));
out.image.filmstripAfter = await p.evaluate(() => document.querySelectorAll('aside[aria-label="Session image history"] button').length);

console.log(JSON.stringify({ out, errors: errors.slice(0, 8) }, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/audit-image.png' });
await b.close();
