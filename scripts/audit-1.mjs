import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const errors = [];
p.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 110)); });
p.on('pageerror', e => errors.push('[pageerror] ' + String(e).slice(0, 110)));
p.on('requestfailed', r => errors.push('[reqfail] ' + r.url().slice(0, 80)));
const out = {};

// LANDING
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2200));
out.landing = await p.evaluate(() => ({
  header: !!document.querySelector('header'),
  heroPrompt: !!document.querySelector('input[aria-label="Describe what you want to create"]'),
  sections: ['how','developers','signals','pricing','faq'].map(id => !!document.getElementById(id)),
  h1: document.querySelector('h1')?.textContent.trim(),
}));

// STUDIO — CHAT
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
out.chat = await p.evaluate(() => ({
  modelSelector: !!document.querySelector('button') && [...document.querySelectorAll('button')].some(b => b.textContent.includes('Nemotron')),
  thinkingBtn: !!document.querySelector('button[aria-label="Extended thinking"]'),
  voiceBtn: !!document.querySelector('button[aria-label="Voice input"]'),
  attachBtn: !!document.querySelector('button[aria-label="Attach files"]'),
  sidebarSessions: document.querySelectorAll('aside section button').length,
  emptyState: document.body.innerText.includes('How can I help you today?'),
}));
// send a real message (free model) — measure latency
const t0 = Date.now();
await p.type('textarea', 'Say only: hello', { delay: 15 });
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1200));
out.chatStreaming = await p.evaluate(() => document.body.innerText.length > 100);
// wait for response to finish
let waited = 0;
while (waited < 25000) {
  await new Promise(r => setTimeout(r, 1500)); waited += 1500;
  const done = await p.evaluate(() => !document.querySelector('[role="status"]'));
  if (done) break;
}
out.chatLatencyMs = Date.now() - t0;
out.chatResponse = await p.evaluate(() => {
  const bubbles = [...document.querySelectorAll('.lux-prose')];
  return bubbles.length ? bubbles[bubbles.length - 1].textContent.trim().slice(0, 80) : null;
});
out.retryBtnOnError = await p.evaluate(() => document.body.innerText.includes('Retry'));

console.log(JSON.stringify({ out, errors: errors.slice(0, 10) }, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/audit-chat.png' });
await b.close();
