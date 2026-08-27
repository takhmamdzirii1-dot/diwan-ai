import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
const ta = await p.$('textarea');
await ta.type('مرحبا', { delay: 40 });
await new Promise(r => setTimeout(r, 900));
const res = await p.evaluate(() => {
  const out = {};
  out.tokenBadgeGone = ![...document.querySelectorAll('span')].some(s => /tok\b/.test(s.textContent) && s.textContent.includes('≈'));
  const send = [...document.querySelectorAll('button')].find(b => b.querySelector('.send-ready, svg') && (b.className.includes('send-ready')));
  if (send) { const cs = getComputedStyle(send); out.send = { bg: cs.backgroundColor, color: cs.color, shadow: cs.boxShadow !== 'none' }; }
  await2: out.text = 'ok';
  return out;
});
console.log(JSON.stringify(res));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/send-check.png' });
await b.close();
