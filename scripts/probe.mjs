import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto('https://ai-alpha-delta-six.vercel.app/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const info = await page.evaluate(() => {
  const out = {};
  // 1) Test element with px-7 alone
  const t = document.createElement('div');
  t.className = 'px-7';
  document.body.appendChild(t);
  out.testPx7 = getComputedStyle(t).paddingLeft;
  t.className = 'pb-4';
  out.testPb4 = getComputedStyle(t).paddingBottom;
  t.remove();

  // 2) Layer order from the main sheet
  const sheet = document.styleSheets[0];
  const top = [];
  for (const rule of sheet.cssRules) {
    if (rule.constructor.name === 'CSSLayerBlockRule') top.push('LAYER:' + rule.name);
    else top.push(rule.constructor.name + ':' + (rule.cssText || '').slice(0, 40));
    if (top.length > 8) break;
  }
  out.sheetTop = top;

  // 3) The actual composer inner: matched padding rules via check on inline + classes
  const el = document.querySelector('.claude-glass-inner');
  out.elPaddingInline = getComputedStyle(el).paddingLeft;
  out.elClasses = el.className;

  // 4) does el match .px-7 ?
  out.elMatchesPx7 = el.matches('.px-7');
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
