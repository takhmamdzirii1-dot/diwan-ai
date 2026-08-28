import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
const out = {};
// Landing must still render after purge
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
out.landing = await p.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim().slice(0,42), errors: !!document.querySelector('#__next-build-error') }));
// Studio: all four workspaces reachable
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
out.nav = await p.evaluate(() => [...document.querySelectorAll('aside button')].map(b=>b.textContent.trim()).filter(t=>['Text Studio','Image Canvas','Motion Studio','Library'].includes(t)));
for (const name of ['Image Canvas','Motion Studio','Library','Text Studio']) {
  await p.evaluate((n) => [...document.querySelectorAll('aside button')].find(b=>b.textContent.trim()===n)?.click(), name);
  await new Promise(r => setTimeout(r, 900));
  out[name] = await p.evaluate(() => document.body.innerText.length > 50);
}
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/final-check.png' });
await b.close();
