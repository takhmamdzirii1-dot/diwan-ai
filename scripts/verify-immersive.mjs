import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
const r = await p.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Open menu"]');
  const shell = document.querySelector('.lux-input-shell');
  const bar = document.querySelector('textarea');
  const out = {};
  if (btn) { const bb = btn.getBoundingClientRect(); const cs = getComputedStyle(btn);
    out.burger = { top: bb.top, left: bb.left, bg: cs.backgroundColor, backdrop: cs.backdropFilter, radius: cs.borderRadius, fixed: cs.position }; }
  if (shell) out.composerHeight = Math.round(shell.getBoundingClientRect().height);
  if (bar) out.textareaPad = getComputedStyle(bar).padding;
  out.oldBarExists = !!document.querySelector('main.pt-14');
  return out;
});
console.log(JSON.stringify(r, null, 2));
await b.close();
