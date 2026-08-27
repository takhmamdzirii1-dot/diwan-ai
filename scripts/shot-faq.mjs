import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

// Scroll to FAQ section
const ok = await page.evaluate(() => {
  const el = document.querySelector('.faq-item') || document.querySelector('#faq');
  if (el) { el.scrollIntoView({ block: 'center' }); return true; }
  return false;
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/faq-check.png' });
console.log('faq found:', ok);
await browser.close();
