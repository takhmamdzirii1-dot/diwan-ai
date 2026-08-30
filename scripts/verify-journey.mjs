import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const out = {};
out.header = await p.evaluate(() => { const h = document.querySelector('header'); return h ? { auth: h.innerText.includes('Sign in'), studio: h.innerText.includes('Open Studio') } : null; });
out.heroPrompt = await p.evaluate(() => !!document.querySelector('input[aria-label="Describe what you want to create"]'));
// Guest flow: type prompt, submit → simulation → claim → auth modal
await p.type('input[aria-label="Describe what you want to create"]', 'Fog over the Atlas mountains');
await p.click('button[aria-label="Generate"]');
await new Promise(r => setTimeout(r, 3000));
out.simDone = await p.evaluate(() => document.body.innerText.includes('Your render is ready.'));
out.claimBtn = await p.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Create a free account to reveal')); return !!b; });
if (out.claimBtn) {
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x=>x.textContent.includes('Create a free account to reveal'))?.click());
  await new Promise(r => setTimeout(r, 800));
  out.authModalOpened = await p.evaluate(() => !!document.querySelector('[role="dialog"], .vantra-modal-card') || document.body.innerText.includes('Sign in to VANTRA') || document.body.innerText.includes('Create VANTRA Account'));
}
// Cinematic: header Open Studio → overlay → /studio
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
await p.evaluate(() => [...document.querySelectorAll('header button')].find(b=>b.textContent.trim()==='Open Studio')?.click());
await new Promise(r => setTimeout(r, 700));
out.cinematicOverlay = await p.evaluate(() => document.body.innerText.includes('Entering Studio') || document.querySelector('[aria-label="Entering VANTRA Studio"]') !== null);
await new Promise(r => setTimeout(r, 1500));
out.landedStudio = await p.evaluate(() => location.pathname === '/studio');
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/journey.png' });
await b.close();
