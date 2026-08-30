import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const out = {};
for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
  await p.setViewport({ width, height });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));
  out[name] = await p.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const h1 = document.querySelector('#hero h1');
    const badge = [...document.querySelectorAll('#hero div')].find(d => d.textContent.trim() === 'Global AI. Local payment.');
    const sub = document.querySelector('#hero p');
    const input = document.querySelector('#hero input[type="text"]');
    const trust = [...document.querySelectorAll('#hero p')].find(x => x.textContent.trim() === 'Edahabia · CIB · DZD payments');
    const primary = [...document.querySelectorAll('#hero button')].find(x => x.getAttribute('aria-label') === 'Start Free' || x.textContent.trim() === 'Start Free');
    const secondary = [...document.querySelectorAll('#hero a')].find(x => x.textContent.trim() === 'See Pricing');
    return {
      badge: !!badge,
      h1: h1 ? { text: h1.textContent.trim(), size: cs(h1).fontSize, gradient: h1.className.includes('bg-clip-text') } : null,
      sub: sub ? { hasDZD: sub.textContent.includes('DZD'), hasNoIntlCard: sub.textContent.includes('no international card') } : null,
      placeholder: input ? input.placeholder : null,
      trust: trust ? { size: cs(trust).fontSize, color: cs(trust).color, transform: cs(trust).textTransform } : null,
      primaryCTA: !!primary,
      secondary: secondary ? { height: cs(secondary).height, borderColor: cs(secondary).borderColor, color: cs(secondary).color } : null,
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  await p.screenshot({ path: `C:/Users/VENOM/AppData/Local/Temp/opencode/hero-copy-${name}.png` });
}
console.log(JSON.stringify(out, null, 2));
await b.close();
