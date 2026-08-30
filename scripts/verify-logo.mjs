import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('https://ai-alpha-delta-six.vercel.app', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 3000));
// scroll to partners section
await p.evaluate(() => { document.querySelector('[aria-label="Technology partners"]')?.scrollIntoView({ block: 'center' }); });
await new Promise(r => setTimeout(r, 1500));
// hover over first logo
const logo = await p.$('section[aria-label="Technology partners"] img');
if (logo) {
  const box = await logo.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await new Promise(r => setTimeout(r, 800));
  const styles = await logo.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      filter: cs.filter,
      opacity: cs.opacity,
      dropShadow: cs.filter.includes('drop-shadow'),
      brightness: cs.filter.includes('brightness'),
    };
  });
  console.log(JSON.stringify(styles, null, 2));
} else {
  console.log('no logo found');
}
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/logo-hover.png' });
await b.close();
