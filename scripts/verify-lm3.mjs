import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 1500));
const out = await p.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Generate"]');
  return {
    innerText: btn?.innerText?.trim(),
    childTags: btn ? [...btn.children].map(c => c.tagName + '.' + (c.className || '').toString().slice(0, 30)) : null,
    html: btn?.innerHTML?.slice(0, 150),
  };
});
console.log(JSON.stringify(out, null, 2));
console.log('console errors:', JSON.stringify(errs.slice(0, 4)));
await b.close();
