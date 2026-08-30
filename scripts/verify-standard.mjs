import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
const out = {};
// CHAT: liquid send present, no white send button
out.chat = await p.evaluate(() => {
  const lm = !!document.querySelector('.claude-glass-inner, [class*="rounded-2xl"]') && [...document.querySelectorAll('button[aria-label="Send"]')].some(b => b.querySelector('.shader-container-exploded, .shader-container-exploded canvas'));
  const whiteSend = [...document.querySelectorAll('button[aria-label="Send message"]')].length;
  const container = [...document.querySelectorAll('div')].find(d => d.className.includes('bg-[#0A0A0B]/90') && d.className.includes('rounded-2xl'));
  return { liquidSend: lm, oldWhiteSend: whiteSend, containerStandard: !!container };
});
// MOTION: liquid generate + container
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Motion Studio')?.click());
await new Promise(r => setTimeout(r, 1100));
out.motion = await p.evaluate(() => {
  const lm = [...document.querySelectorAll('button[aria-label="Generate"]')].filter(b => b.querySelector('.shader-container-exploded')).length;
  const container = [...document.querySelectorAll('div')].find(d => d.className.includes('bg-[#0A0A0B]/90') && d.className.includes('border-white/5'));
  const cost = [...document.querySelectorAll('span')].filter(s => s.className.includes('tracking-widest') && /pts/i.test(s.textContent)).map(s => s.textContent.trim());
  return { liquidGenerate: lm, containerStandard: !!container, costSubtle: cost };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
