import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
const out = await p.evaluate(() => ({
  title: document.title,
  desc: document.querySelector('meta[name="description"]')?.content?.slice(0, 60),
  ogTitle: document.querySelector('meta[property="og:title"]')?.content,
  icon: document.querySelector('link[rel="icon"]')?.getAttribute('href'),
}));
console.log(JSON.stringify(out, null, 2));
await b.close();
