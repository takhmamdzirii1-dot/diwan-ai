import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const out = await p.evaluate(() => {
  // All base-layer divs (the ones with margin: 2px) — hero CTA + composer Generate in this page
  const inners = [...document.querySelectorAll('div')].filter(d => (d.getAttribute('style') || '').replace(/\s/g, '').includes('margin:2px'));
  const innerInfo = inners.map(d => {
    const s = getComputedStyle(d);
    return { bg: s.backgroundColor, bgImage: s.backgroundImage === 'none' ? 'none' : 'gradient', border: `${s.borderTopWidth} ${s.borderTopColor}` };
  });
  // Label spans: find the one with text "Start Free" inside the shader button stack
  const spans = [...document.querySelectorAll('span')].filter(s => s.textContent.trim() === 'Start Free' && s.getAttribute('style'));
  const label = spans.length ? getComputedStyle(spans[spans.length - 1]) : null;
  // Button dimensions
  const btns = [...document.querySelectorAll('button[aria-label="Start Free"]')];
  return {
    innerCount: inners.length,
    innerInfo,
    labelColor: label ? label.color : null,
    labelWeight: label ? label.fontWeight : null,
    ctaSize: btns.length ? `${btns[0].offsetWidth}x${btns[0].offsetHeight}` : null,
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
