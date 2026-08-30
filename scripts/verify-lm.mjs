import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
const out = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('#hero button')].find(b => b.textContent.includes('Start Creating Free'));
  if (!btn) return { found: false };
  const br = btn.getBoundingClientRect();
  const canvas = btn.querySelector('canvas');
  const cr = canvas ? canvas.getBoundingClientRect() : null;
  return {
    found: true,
    buttonSize: { w: Math.round(br.width), h: Math.round(br.height) },
    canvasFillsButton: canvas ? { w: Math.round(cr.width), h: Math.round(cr.height), fills: cr.width >= br.width - 2 && cr.height >= br.height - 2 } : 'no-canvas',
    borderCount: btn.querySelectorAll('span[aria-hidden]').length,
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/lm-fixed.png' });
await b.close();
