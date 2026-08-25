import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'https://ai-alpha-delta-six.vercel.app/studio';
const out = process.argv[3] || 'C:/Users/VENOM/AppData/Local/Temp/opencode/studio.png';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

// Type a message so the send button becomes active, then screenshot the composer
await page.waitForSelector('textarea', { timeout: 15000 }).catch(() => {});
const ta = await page.$('textarea');
if (ta) {
  await ta.type('hello', { delay: 30 });
  await new Promise((r) => setTimeout(r, 800));
}

// Screenshot full page
await page.screenshot({ path: out });

// Zoomed screenshot of the composer area
if (ta) {
  const box = await ta.boundingBox();
  if (box) {
    await page.screenshot({
      path: out.replace('.png', '-composer.png'),
      clip: {
        x: Math.max(0, box.x - 60),
        y: Math.max(0, box.y - 60),
        width: Math.min(1400, box.width + 120),
        height: box.height + 160,
      },
    });
  }
}
await browser.close();
console.log('saved: ' + out);
