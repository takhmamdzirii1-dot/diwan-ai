import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
const out = {};
// sidebar has Image Library
out.hasLibraryNav = await p.evaluate(() => [...document.querySelectorAll('aside button')].some(b => b.textContent.includes('Image Library')));
// open Image Canvas
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.includes('Image Canvas'))?.click());
await new Promise(r => setTimeout(r, 800));
// open popover and select the 2nd model
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /·\s*x\d/.test(b.textContent))?.click());
await new Promise(r => setTimeout(r, 700));
await p.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-label="Image generation settings"]');
  [...d.querySelectorAll('button')].find(b => b.textContent.includes('Flux Realism v2'))?.click();
});
await new Promise(r => setTimeout(r, 600));
out.pillAfterModelSwitch = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /·\s*x\d/.test(b.textContent));
  return btn ? btn.textContent.trim() : null;
});
out.checkmarkCount = await p.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-label="Image generation settings"]');
  return d ? [...d.querySelectorAll('svg.lucide-check')].length : -1;
});
// close popover, set count x2, generate
await p.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 400));
const ta = await p.$('textarea');
await ta.type('Casbah of Algiers at golden hour', { delay: 12 });
await new Promise(r => setTimeout(r, 300));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Generate')?.click());
await new Promise(r => setTimeout(r, 4500));
out.feed = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('img[alt]')].filter(i => i.src.includes('picsum'));
  return { imageCount: cards.length, firstFits: cards[0] ? getComputedStyle(cards[0]).objectFit : null };
});
out.actionsHidden = await p.evaluate(() => {
  const bar = document.querySelector('button[aria-label="Download image"]')?.parentElement;
  return bar ? getComputedStyle(bar).opacity : null;
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/feed-check.png' });
await b.close();
