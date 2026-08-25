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
  const inner = document.querySelector('.claude-glass-inner');
  const shell = document.querySelector('.lux-input-shell');
  const actionBar = inner ? inner.querySelector(':scope > div:last-child') : null;
  const out = {};
  if (inner) {
    const cs = getComputedStyle(inner);
    out.inner = {
      classes: inner.className,
      padding: cs.padding,
      display: cs.display,
      overflow: cs.overflow,
    };
  }
  if (shell) {
    const cs = getComputedStyle(shell);
    out.shell = { padding: cs.padding, borderRadius: cs.borderRadius, overflow: cs.overflow };
  }
  if (actionBar) {
    const cs = getComputedStyle(actionBar);
    out.actionBar = {
      classes: actionBar.className,
      padding: cs.padding,
      marginBottom: cs.marginBottom,
    };
  }
  // send button position relative to shell
  const send = document.querySelector('button[aria-label="Send message"]');
  if (send && shell) {
    const sb = send.getBoundingClientRect();
    const sh = shell.getBoundingClientRect();
    out.send = {
      rightGap: Math.round(sh.right - sb.right),
      bottomGap: Math.round(sh.bottom - sb.bottom),
      w: Math.round(sb.width),
      h: Math.round(sb.height),
    };
  }
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
