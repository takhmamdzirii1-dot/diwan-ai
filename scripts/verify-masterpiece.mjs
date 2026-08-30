import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 950 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(() => {
  const ids = ['hero','showcase','how','developers','signals','pricing','faq','__next'];
  return {
    flow: ids.map(id => ({ id, exists: !!document.getElementById(id) })),
    marqueeCards: document.querySelectorAll('figure').length,
    faqCount: [...document.querySelectorAll('button[aria-expanded]')].filter(b => b.closest('#faq')).length,
    magnetic: !!document.querySelector('button')?.closest('[style]'),
    terminalLines: [...document.querySelectorAll('section#developers div')].some(d => d.textContent.includes('api.vantra.ai')),
  };
});
// test FAQ toggle
await p.evaluate(() => document.getElementById('faq')?.scrollIntoView());
await new Promise(r => setTimeout(r, 900));
const faqBtns = await p.$$('#faq button[aria-expanded]');
await faqBtns[2].click();
await new Promise(r => setTimeout(r, 600));
out.faqToggleWorks = await p.evaluate(() => document.querySelector('#faq [aria-expanded="true"]')?.textContent.includes('own what I generate'));
console.log(JSON.stringify(out, null, 2));
await b.close();
