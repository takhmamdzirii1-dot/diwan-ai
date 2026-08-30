import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(() => {
  const body = document.body.innerText;
  const sections = [...document.querySelectorAll('section, footer')].map(s => s.id || s.querySelector('h2')?.textContent.trim().slice(0, 22) || s.tagName);
  return {
    badgeNew: body.includes('Next-Generation AI Studio'),
    badgeOldGone: !body.includes('Edahabia & CIB') && !body.includes('100% Algerian Platform'),
    subNew: body.includes('Start creating instantly'),
    flow: sections,
    tiers: [...document.querySelectorAll('h3, p')].map(x => x.textContent.trim()).filter(t => ['Hobby', 'Pro', 'Studio'].includes(t)),
    proBadge: body.includes('Most Popular'),
    footerLinks: [...document.querySelectorAll('footer a')].map(a => a.textContent.trim()),
    legacyPurged: !body.includes('Cost Table') && !body.includes('Model Arena') && !body.includes('Darja'),
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/global-final.png', fullPage: false });
await b.close();
