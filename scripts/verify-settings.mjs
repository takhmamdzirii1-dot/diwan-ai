import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 900 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
// open settings from sidebar
const btn = await p.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Settings'));
await btn.asElement().click();
await new Promise(r => setTimeout(r, 700));
const res = await p.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const out = { modalOpen: !!dlg };
  if (dlg) {
    const cs = getComputedStyle(dlg);
    out.container = { bg: cs.backgroundColor, radius: cs.borderRadius };
    out.tabs = [...dlg.querySelectorAll('button')].filter(b => ['Profile & General','AI Behavior','Billing & Plans','Data & Privacy'].includes(b.textContent.trim())).length;
  }
  return out;
});
console.log(JSON.stringify(res));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/settings-profile.png' });
// go to Billing tab
await p.evaluate(() => { [...document.querySelectorAll('button')].find(b => b.textContent.includes('Billing'))?.click(); });
await new Promise(r => setTimeout(r, 900));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/settings-billing.png' });
await b.close();
