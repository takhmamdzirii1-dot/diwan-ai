import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const errors = [];
p.on('pageerror', e => errors.push('[pageerror] ' + String(e).slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)); });
await p.goto('https://ai-alpha-delta-six.vercel.app/studio', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 5000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Flux\.1 Pro ·/.test(b.textContent))?.click());
await new Promise(r => setTimeout(r, 1500));
const state = await p.evaluate(() => ({
  dialog: !!document.querySelector('[role="dialog"][aria-label="Image generation settings"]'),
  reactRootHasChildren: document.querySelector('#__next, body > div')?.children.length,
}));
console.log(JSON.stringify({ state, errors }, null, 2));
await b.close();
