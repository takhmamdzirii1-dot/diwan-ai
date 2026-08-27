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
  const read = (el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight };
  };

  // Real user-bubble structure
  const userWrap = document.createElement('div');
  userWrap.className = 'user-bubble-gloss';
  userWrap.style.cssText = 'position:absolute;visibility:hidden;';
  userWrap.innerHTML = '<p class="text-[15px] text-white/90 font-medium leading-relaxed whitespace-pre-wrap break-words">مرحبا تجربة</p>';

  // Real AI-bubble structure
  const aiWrap = document.createElement('div');
  aiWrap.className = 'lux-prose';
  aiWrap.style.cssText = 'position:absolute;visibility:hidden;';
  aiWrap.innerHTML = '<p dir="auto">Hello test</p>';

  document.body.append(userWrap, aiWrap);
  const out = {
    userBubble: read(userWrap.querySelector('p')),
    aiBubble: read(aiWrap.querySelector('p')),
  };
  userWrap.remove();
  aiWrap.remove();
  return out;
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
