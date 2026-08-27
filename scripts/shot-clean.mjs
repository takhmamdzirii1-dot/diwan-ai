import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});

// Desktop
const d = await browser.newPage();
await d.setViewport({ width: 1600, height: 900 });
await d.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await d.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/clean-desktop.png' });

// Mobile (iPhone-ish)
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await m.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/clean-mobile.png' });

console.log('saved both');
await browser.close();
