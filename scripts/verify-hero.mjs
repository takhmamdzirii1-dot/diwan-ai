import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(() => ({
  badge: [...document.querySelectorAll('div')].some(d => d.className.includes('backdrop-blur-md') && d.textContent.includes('100% Algerian Platform')),
  gradientH1: (() => { const h = document.querySelector('h1'); return h ? { text: h.textContent.trim(), gradient: h.className.includes('bg-clip-text') } : null; })(),
  ctas: [...document.querySelectorAll('a,button')].filter(x => /Get Started|Explore Cost Table/.test(x.textContent)).length,
  stats: [...document.querySelectorAll('span')].filter(s => /^12\+$|^100%$|^0s$|^99\.9%$/.test(s.textContent.trim())).length,
  paths: document.querySelectorAll('section#hero div[aria-hidden="true"] > div').length,
}));
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/hero-v2.png' });
await b.close();
