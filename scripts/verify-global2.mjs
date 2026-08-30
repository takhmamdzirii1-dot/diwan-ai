import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
const out = await p.evaluate(() => {
  const body = document.body.innerText;
  return {
    proBadgeUpper: body.toUpperCase().includes('MOST POPULAR'),
    modelArena: body.includes('Model Arena'),
    darja: body.includes('Darja'),
    costTableOnlyInCTA: body.includes('Explore Cost Table') && !body.includes('Cost Table ('),
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
