import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.includes('Motion Studio'))?.click());
await new Promise(r => setTimeout(r, 1000));
const out = {};
out.headerText = await p.evaluate(() => [...document.querySelectorAll('p')].map(x=>x.textContent.trim()).find(t => t === 'Motion Studio') || null);
out.pill = await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Kling|Runway/.test(x.textContent) && x.textContent.includes('·')); return b? b.textContent.trim():null; });
out.genButton = await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Generate')); return b? b.textContent.replace(/\s+/g,' ').trim():null; });
// open popover, switch to Runway + 10s
await p.evaluate(() => [...document.querySelectorAll('button')].find(x=>/Kling|Runway/.test(x.textContent) && x.textContent.includes('·'))?.click());
await new Promise(r => setTimeout(r, 700));
out.popover = await p.evaluate(() => {
  const d = document.querySelector('[role="dialog"][aria-label="Video generation settings"]');
  if (!d) return null;
  return { labels: [...d.querySelectorAll('p')].map(x=>x.textContent.trim()).slice(0,8), cameras: d.querySelector('select')?.options.length };
});
await p.evaluate(() => { const d=document.querySelector('[role="dialog"][aria-label="Video generation settings"]'); [...d.querySelectorAll('button')].find(b=>b.textContent.includes('Runway'))?.click(); });
await new Promise(r => setTimeout(r, 400));
await p.evaluate(() => { const d=document.querySelector('[role="dialog"][aria-label="Video generation settings"]'); [...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='10s')?.click(); });
await new Promise(r => setTimeout(r, 500));
await p.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 400));
out.pillAfter = await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Kling|Runway/.test(x.textContent) && x.textContent.includes('·')); return b? b.textContent.trim():null; });
out.costAfter = await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('pts')); return b? b.textContent.replace(/\s+/g,' ').trim():null; });
// generate -> rendering state
const ta = await p.$('textarea');
await ta.type('Drone over Jijel cliffs', { delay: 10 });
await new Promise(r => setTimeout(r, 300));
await p.evaluate(() => [...document.querySelectorAll('button')].find(x=>x.textContent.includes('Generate'))?.click());
await new Promise(r => setTimeout(r, 1200));
out.rendering = await p.evaluate(() => [...document.querySelectorAll('p')].some(x=>x.textContent.includes('Rendering Cinematic Scene')));
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/motion-studio.png' });
await b.close();
