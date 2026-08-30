import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:3000/studio', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
// Click into the composer to trigger focus
await p.click('textarea');
await new Promise(r => setTimeout(r, 500));
// Type to trigger glowActive
await p.type('textarea', 'test', { delay: 20 });
await new Promise(r => setTimeout(r, 1200));
const out = await p.evaluate(() => {
  const glow = document.querySelector('.vantra-glow-breathe');
  const orbit = document.querySelector('.vantra-orbit-ring');
  const cs = glow ? getComputedStyle(glow) : null;
  const csO = orbit ? getComputedStyle(orbit) : null;
  // check all children of the composer container are visible
  const surface = document.querySelector('textarea')?.closest('.z-10');
  const childrenVisible = surface ? [...surface.querySelectorAll('button, input, textarea, span')].filter(el => {
    const s = getComputedStyle(el);
    return s.display === 'none' || s.visibility === 'hidden';
  }).length : -1;
  return {
    glowExists: !!glow,
    glowOpacity: cs?.opacity,
    glowAnimating: cs?.animationName,
    orbitExists: !!orbit,
    orbitOpacity: csO?.opacity,
    orbitAnimating: csO?.animationName,
    hiddenChildren: childrenVisible,
    composerHasContent: !!document.querySelector('textarea[value], textarea'),
  };
});
console.log(JSON.stringify(out, null, 2));
await p.screenshot({ path: 'C:/Users/VENOM/AppData/Local/Temp/opencode/glow-verify.png' });
await b.close();
