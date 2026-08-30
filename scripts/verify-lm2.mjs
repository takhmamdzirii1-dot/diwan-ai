import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 1200));
const out = await p.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Generate"]');
  return {
    exists: !!btn,
    shaderDiv: !!btn?.querySelector('.shader-container-exploded'),
    canvasMounted: !!btn?.querySelector('.shader-container-exploded canvas'),
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
