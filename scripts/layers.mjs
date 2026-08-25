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
  const out = { sheets: [], px7Rules: [], winners: [] };
  for (const sheet of document.styleSheets) {
    out.sheets.push(sheet.href || 'inline');
    try {
      const walk = (rules, layer) => {
        for (const rule of rules) {
          if (rule.cssRules) {
            walk(rule.cssRules, rule.name ? `@layer ${rule.name}` : layer);
          } else if (rule.selectorText && /\.px-7\b/.test(rule.selectorText)) {
            out.px7Rules.push({ layer, css: rule.cssText.slice(0, 120) });
          }
        }
      };
      walk(sheet.cssRules, 'unlayered');
    } catch (e) {
      out.sheets.push('CORS-blocked: ' + String(e).slice(0, 60));
    }
  }
  // Which rules actually apply to the element?
  const el = document.querySelector('.claude-glass-inner');
  if (el) {
    for (const sheet of document.styleSheets) {
      try {
        const walk = (rules) => {
          for (const rule of rules) {
            if (rule.cssRules) { walk(rule.cssRules); continue; }
            if (rule.selectorText) {
              try {
                if (el.matches(rule.selectorText) && /padding/.test(rule.cssText)) {
                  out.winners.push({ selector: rule.selectorText.slice(0, 60), css: rule.style.cssText.slice(0, 100) });
                }
              } catch {}
            }
          }
        };
        walk(sheet.cssRules);
      } catch {}
    }
  }
  return out;
});
console.log(JSON.stringify(info, null, 2).slice(0, 3000));
await browser.close();
