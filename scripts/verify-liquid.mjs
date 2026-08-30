import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(() => {
  const canvases = document.querySelectorAll('canvas');
  return {
    webglCanvas: canvases.length,
    liquidBtn: [...document.querySelectorAll('button')].some(b => b.className.includes('group/lm') && b.textContent.includes('Start Creating Free')),
    iconMode: !!document.querySelector('button[aria-label="Generate"] canvas, button[aria-label="Generate"] .group\\/lm'),
    layering: (() => { const s = document.querySelector('section#hero div[aria-hidden="true"] > div'); return s ? getComputedStyle(s).zIndex : null; })(),
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/liquid-hero.png' });
await b.close();
