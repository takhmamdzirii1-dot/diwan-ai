import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await p.evaluate(() => document.getElementById('developers')?.scrollIntoView());
await new Promise(r => setTimeout(r, 3500));
const out = await p.evaluate(() => {
  const t = document.querySelector('#developers').innerText;
  return { typed: t.includes('api.vantra.ai/v1/generate'), json: t.includes('credits_left'), ok: t.includes('200 OK') };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/masterpiece.png', fullPage: true });
await b.close();
