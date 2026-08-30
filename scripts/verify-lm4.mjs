import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 1500));
const out = await p.evaluate(() => {
  const divs = [...document.querySelectorAll('.shader-container-exploded')];
  return {
    mounts: divs.length,
    canvases: divs.filter(d => d.querySelector('canvas')).length,
    sizes: divs.map(d => { const r = d.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }),
    sparklesLayer: [...document.querySelectorAll('#studio, body')].length > 0,
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/refined2.png' });
await b.close();
