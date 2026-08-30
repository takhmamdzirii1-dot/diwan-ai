import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 1000));
const out = await p.evaluate(() => ({
  headerGone: !document.querySelector('main header'),
  filmstrip: (() => { const a = document.querySelector('aside[aria-label="Session image history"]'); if (!a) return null; const cs = getComputedStyle(a); const r = a.getBoundingClientRect(); return { right: cs.right, top: cs.top, border: cs.borderColor }; })(),
  liquidGenerate: !!document.querySelector('button[aria-label="Generate"] canvas'),
  creditText: [...document.querySelectorAll('span')].some(s => s.textContent.trim() === '1 credit' && s.className.includes('text-white/30')),
}));
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/canvas-refined.png' });
await b.close();
