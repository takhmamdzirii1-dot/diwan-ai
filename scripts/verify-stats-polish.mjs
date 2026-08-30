import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const out = {};

const grab = () => p.evaluate(() => {
  const hero = document.getElementById('hero');
  const stats = [...hero.querySelectorAll('.grid > div')].map(d => ({
    num: d.querySelector('span')?.textContent.trim(),
    label: d.querySelectorAll('span')[1]?.textContent.trim(),
  }));
  const grid = hero.querySelector('.grid');
  const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
  const h1 = hero.querySelector('h1');
  const sub = hero.querySelector('h1 + p');
  const trust = [...hero.querySelectorAll('p')].find(x => x.textContent.includes('DZD payments'));
  const bgLine = [...hero.querySelectorAll('div[aria-hidden="true"] > div')].find(d => (d.style.background || '').includes('linear-gradient(to bottom'));
  return {
    stats,
    cols,
    statLabelColor: stats[0] ? getComputedStyle(hero.querySelectorAll('.grid span[class*="text-sm"]')[0]).color : null,
    h1Leading: getComputedStyle(h1).lineHeight,
    h1MaxW: getComputedStyle(h1).maxWidth,
    subColor: sub ? getComputedStyle(sub).color : null,
    trustColor: trust ? getComputedStyle(trust).color : null,
    bgLineBg: bgLine ? bgLine.style.background : null,
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    overflowCells: [...hero.querySelectorAll('.grid > div')].filter(d => d.scrollWidth > d.clientWidth + 1).length,
  };
});

for (const [name, width, height] of [['desktop1440', 1440, 900], ['desktop1920', 1920, 1080], ['tablet768', 768, 1024], ['mobile390', 390, 844]]) {
  await p.setViewport({ width, height });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2200));
  await p.evaluate(() => document.getElementById('hero').scrollIntoView());
  await new Promise(r => setTimeout(r, 400));
  out[name] = await grab();
}
console.log(JSON.stringify(out, null, 2));
await b.close();
