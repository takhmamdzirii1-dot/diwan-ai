import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('https://ai-alpha-delta-six.vercel.app/studio', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 5000));
const out = {};
// SETTINGS via profile menu
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.getAttribute('aria-haspopup') === 'menu' || b.textContent.includes('Guest') || b.querySelector('svg.lucide-settings'))?.click());
await new Promise(r => setTimeout(r, 800));
out.profileMenu = await p.evaluate(() => !!document.querySelector('[role="menu"]'));
if (out.profileMenu) {
  await p.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].find(b => b.textContent.includes('Settings'))?.click());
  await new Promise(r => setTimeout(r, 900));
}
out.settingsOpen = await p.evaluate(() => !!document.querySelector('[role="dialog"][aria-label="Settings"]'));
out.settingsTabs = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].map(b => b.textContent.trim()).filter(t => /Profile|Behavior|Billing|Privacy/.test(t)));
// close, check MOTION cost
await p.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 500));
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Motion Studio')?.click());
await new Promise(r => setTimeout(r, 1500));
out.motionCost = await p.evaluate(() => [...document.querySelectorAll('span')].filter(s => /^\d+ pts$/.test(s.textContent.trim())).map(s => s.textContent.trim()));
out.motionLiquid = await p.evaluate(() => !!document.querySelector('.shader-container-exploded canvas'));
// CHAT send full round-trip on PRODUCTION
await p.evaluate(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Chat Studio')?.click());
await new Promise(r => setTimeout(r, 1200));
await p.evaluate(() => { const ta = document.querySelector('textarea'); if (ta) { ta.value = 'Reply with one word: ready'; ta.dispatchEvent(new Event('input', { bubbles: true })); } });
await new Promise(r => setTimeout(r, 300));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.querySelector('.shader-container-exploded'))?.click());
await new Promise(r => setTimeout(r, 6000));
out.chatReply = await p.evaluate(() => { const b = [...document.querySelectorAll('.lux-prose')]; return b.length ? b[b.length - 1].textContent.trim().slice(0, 40) : null; });
console.log(JSON.stringify(out, null, 2));
await b.close();
