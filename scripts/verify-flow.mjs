import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 900 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
// Part 1: sidebar must show NO empty session on first load
const initial = await p.evaluate(() => ({
  emptyState: [...document.querySelectorAll('aside div')].some(d => d.textContent.trim() === 'No recent chats'),
  titles: [...document.querySelectorAll('aside span.truncate')].map(s => s.textContent.trim()),
}));
// Part 2: open Image Canvas, click config pill
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Image Canvas'))?.click());
await new Promise(r => setTimeout(r, 900));
const pillText = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /·\s*x\d/.test(b.textContent));
  return btn ? btn.textContent.trim() : null;
});
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /·\s*x\d/.test(b.textContent))?.click());
await new Promise(r => setTimeout(r, 800));
const popover = await p.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-label="Image generation settings"]');
  if (!d) return null;
  return {
    models: [...d.querySelectorAll('p')].map(x => x.textContent.trim()).filter(t => t && !/^(MODEL|ASPECT RATIO|IMAGES)$/i.test(t)).slice(0, 6),
    cost: [...d.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => t.startsWith('Cost:')),
  };
});
console.log(JSON.stringify({ initial, pillText, popover }, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/flow-popover.png' });
await b.close();
