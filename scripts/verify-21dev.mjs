import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(() => {
  const shaderDivs = document.querySelectorAll('.shader-container-exploded');
  const fillCheck = [...shaderDivs].map(d => { const c = d.querySelector('canvas'); const dr = d.getBoundingClientRect(); const cr = c ? c.getBoundingClientRect() : null; return c && cr ? { dw: Math.round(dr.width), cw: Math.round(cr.width), fills: cr.width >= dr.width - 2 } : null; });
  const cta = [...document.querySelectorAll('#hero button')].find(b => b.getAttribute('aria-label') === 'Start Free' || b.getAttribute('aria-label') === 'Enter Studio');
  const icon = [...document.querySelectorAll('#hero button')].find(b => b.getAttribute('aria-label') === 'Generate');
  return {
    shaderMounts: shaderDivs.length,
    fillCheck,
    ctaLabel: cta ? cta.getAttribute('aria-label') : null,
    iconPresent: !!icon,
    sparklesInIcon: icon ? icon.querySelectorAll('svg').length : 0,
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/21dev-integration.png' });
await b.close();
