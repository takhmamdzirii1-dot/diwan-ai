import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('https://ai-alpha-delta-six.vercel.app/studio', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 5000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Image Canvas')?.click());
await new Promise(r => setTimeout(r, 2000));
// real mouse click on the pill
const pillHandle = await p.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Flux\.1 Pro ·/.test(b.textContent)));
const box = await pillHandle.asElement().boundingBox();
if (box) await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await new Promise(r => setTimeout(r, 1200));
const out = await p.evaluate(() => {
  const pill = [...document.querySelectorAll('button')].find(b => /Flux\.1 Pro ·/.test(b.textContent));
  return {
    pillAriaExpanded: pill?.getAttribute('aria-expanded'),
    dialog: !!document.querySelector('[role="dialog"]'),
    popoverText: document.body.innerText.includes('Aspect Ratio') && document.body.innerText.includes('Ultra Realism'),
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/prod-pill.png' });
await b.close();
