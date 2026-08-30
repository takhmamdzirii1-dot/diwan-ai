import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Motion Studio')?.click());
await new Promise(r => setTimeout(r, 1100));
const out = await p.evaluate(() => {
  const bar = [...document.querySelectorAll('div')].find(d => d.className.includes('rounded-2xl') && d.className.includes('bg-black/60') && d.querySelector('input'));
  const input = bar?.querySelector('input');
  const pill = bar?.querySelector('button');
  const lm = [...document.querySelectorAll('#studio, body > div button')].filter(b => b.querySelector('.shader-container-exploded')).length;
  const cost = [...document.querySelectorAll('span')].filter(s => /^\d+ pts$/i.test(s.textContent.trim()) && s.className.includes('tracking-widest')).map(s => s.textContent.trim());
  return {
    singleRowLayout: !!input && !!pill && lm > 0,
    inputPlaceholder: input?.placeholder?.slice(0, 30),
    pillText: pill?.textContent.trim(),
    liquidButtons: lm,
    costBelowBar: cost,
    oldGiantButtonGone: ![...document.querySelectorAll('button')].some(b => b.textContent.trim().startsWith('Generate') && b.className.includes('w-full')),
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/motion-command.png' });
await b.close();
