import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 900 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
// send a message to auto-title the session
const ta = await p.$('textarea');
await ta.type('Marketing plan for Algeria', { delay: 20 });
await new Promise(r => setTimeout(r, 400));
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 2500));
// click New Chat
const nc = await p.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'New Chat'));
await nc.asElement().click();
await new Promise(r => setTimeout(r, 1200));
const res = await p.evaluate(() => {
  const titles = [...document.querySelectorAll('aside button span.truncate')].map(s => s.textContent.trim());
  const empty = [...document.querySelectorAll('aside div')].some(d => d.textContent.trim() === 'No recent chats');
  return { sidebarTitles: titles.slice(0, 8), emptyStateShown: empty };
});
console.log(JSON.stringify(res, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/history-check.png' });
await b.close();
