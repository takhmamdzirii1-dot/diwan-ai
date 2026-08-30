import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('https://ai-alpha-delta-six.vercel.app/studio', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 5000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(() => ({
  url: location.href,
  allButtonTexts: [...document.querySelectorAll('main button, body > div button')].map(b => b.textContent.trim().slice(0, 40)).filter(Boolean).slice(0, 25),
  hasTextarea: !!document.querySelector('textarea'),
  placeholders: [...document.querySelectorAll('textarea,input')].map(i => i.placeholder).filter(Boolean),
}));
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/prod-image.png' });
await b.close();
