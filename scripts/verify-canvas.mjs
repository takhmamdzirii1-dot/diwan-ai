import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 900 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
// Open Image Canvas via sidebar
const btn = await p.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Image Canvas')));
await btn.asElement().click();
await new Promise(r => setTimeout(r, 900));
const res = await p.evaluate(() => {
  const out = {};
  out.canvasPlaceholder = [...document.querySelectorAll('p')].some(p2 => p2.textContent.includes('Canvas is ready'));
  out.hasTextarea = !!document.querySelector('textarea[placeholder*="Describe the image"]');
  const sel = document.querySelector('select[aria-label="Aspect ratio"]');
  out.aspectOptions = sel ? sel.options.length : 0;
  const gen = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Generate');
  if (gen) { const cs = getComputedStyle(gen); out.generate = { bg: cs.backgroundColor, disabled: gen.disabled }; }
  const ws = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Text Studio'));
  if (ws) { const cs = getComputedStyle(ws); out.textStudioActive = cs.backgroundColor; }
  return out;
});
console.log(JSON.stringify(res, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/image-canvas.png' });
await b.close();
