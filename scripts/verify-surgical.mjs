import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
const out = await p.evaluate(() => {
  const heroCanvases = document.querySelectorAll('#hero canvas').length;
  const glassSubmit = (() => { const b = document.querySelector('button[aria-label="Generate"]'); if (!b) return null; const cs = getComputedStyle(b); return { rounded: cs.borderRadius, glow: cs.boxShadow !== 'none', white: cs.backgroundColor }; })();
  const liquidCta = [...document.querySelectorAll('#hero button canvas')].length;
  const inputBarIntact = (() => { const i = document.querySelector('input[aria-label="Describe what you want to create"]'); if (!i) return null; const bar = i.closest('div.relative'); return bar ? bar.getBoundingClientRect().height : null; })();
  return { heroWebglCanvases: heroCanvases, glassSubmit, liquidMetalOnlyOnCTA: liquidCta, inputBarHeight: inputBarIntact };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
