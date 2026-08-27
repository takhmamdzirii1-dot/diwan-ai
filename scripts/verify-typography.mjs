import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

const result = await page.evaluate(() => {
  const out = {};

  // 1) AI prose typography — probe with a real element
  const probe = document.createElement('div');
  probe.className = 'lux-prose';
  probe.style.cssText = 'position:absolute;visibility:hidden;';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  out.aiProse = { color: cs.color, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight };
  probe.remove();

  // 2) user bubble classes present in built CSS
  let found = { white90: false, fontMedium: false, leadingRelaxed: false };
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const sel = rule.selectorText || '';
        if (sel.includes('.text-white\\/90')) found.white90 = true;
        if (sel.includes('.font-medium')) found.fontMedium = true;
        if (sel.includes('.leading-relaxed')) found.leadingRelaxed = true;
      }
    } catch {}
  }
  out.userBubbleClasses = found;

  // 3) secondary text colors
  const footer = [...document.querySelectorAll('p')].find((p) => p.textContent.includes('can make mistakes'));
  if (footer) out.footerColor = getComputedStyle(footer).color;

  return out;
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
