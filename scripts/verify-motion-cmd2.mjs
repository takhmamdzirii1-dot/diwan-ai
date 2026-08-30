import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Motion Studio')?.click());
await new Promise(r => setTimeout(r, 1500));
const out = await p.evaluate(() => {
  const mounts = document.querySelectorAll('.shader-container-exploded');
  const btn = document.querySelector('button[aria-label="Generate"]');
  const cs = btn ? getComputedStyle(btn) : null;
  return {
    shaderMounts: mounts.length,
    canvases: [...mounts].filter(d => d.querySelector('canvas')).length,
    size: (() => { const d = mounts[0]; return d ? Math.round(d.getBoundingClientRect().width) + 'x' + Math.round(d.getBoundingClientRect().height) : null; })(),
    generateBtnRounded: cs?.borderRadius,
    layoutRow: (() => { const bar = document.querySelector('input[aria-label="Video prompt"]')?.closest('div.flex'); return bar ? getComputedStyle(bar).flexDirection : null; })(),
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/motion-cmd2.png' });
await b.close();
