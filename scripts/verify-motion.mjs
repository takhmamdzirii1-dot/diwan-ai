import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const result = await page.evaluate(() => {
  const out = {};
  const pick = (sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return (out[sel] = 'NOT FOUND');
    const cs = getComputedStyle(el);
    out[sel] = {};
    props.forEach((p) => (out[sel][p] = cs[p]));
  };

  // 1) transitions no longer use "all"
  pick('.btn-primary', ['transitionProperty', 'transitionDuration']);
  pick('.vantra-btn-submit', ['transitionProperty']);
  pick('.toast', ['transitionProperty', 'transitionDuration']);
  pick('.glass-pill', ['transitionProperty']);
  pick('.ticket-cta-btn', ['transitionProperty']);

  // 2) FAQ accordion = grid rows technique
  pick('.faq-answer', ['display', 'gridTemplateRows', 'transitionProperty']);
  pick('.faq-item.open .faq-answer', ['gridTemplateRows']);

  // 3) dropdown animation class present in stylesheet
  let hasPop = false;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.name === 'dropdown-pop' || (rule.selectorText || '').includes('user-dropdown')) hasPop = true;
      }
    } catch {}
  }
  out.dropdownPopKeyframeExists = hasPop;

  // 4) press feedback rule exists
  let hasActive = false;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if ((rule.selectorText || '').includes('.vantra-btn-submit:active')) hasActive = true;
      }
    } catch {}
  }
  out.pressFeedbackRuleExists = hasActive;

  // 5) hover gating media query exists
  let hoverGate = false;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if ((rule.media && rule.media.mediaText.includes('hover')) || false) hoverGate = true;
      }
    } catch {}
  }
  out.hoverGatedMediaExists = hoverGate;

  // 6) any element still transitioning "all" among key interactive selectors
  const suspects = ['.lang-btn', '.ledger-tab', '.quick-tag', '.model-pill-text', '.modal-close', '.payment-option-card', '.clear-search-btn', '.filter-tab'];
  out.stillAll = [];
  suspects.forEach((s) => {
    const el = document.querySelector(s);
    if (el && getComputedStyle(el).transitionProperty.includes('all')) out.stillAll.push(s);
  });

  return out;
});

// 7) FAQ click behavior — open second item, measure height
const faqBtns = await page.$$('.faq-item button, .faq-item .faq-question, .faq-item [class*="question"]');
if (faqBtns.length > 1) {
  await faqBtns[1].click();
  await new Promise((r) => setTimeout(r, 500));
  result.faqAfterClick = await page.evaluate(() => {
    const items = document.querySelectorAll('.faq-item');
    const second = items[1];
    const ans = second ? second.querySelector('.faq-answer') : null;
    if (!ans) return 'no .faq-answer';
    const cs = getComputedStyle(ans);
    return { gridTemplateRows: cs.gridTemplateRows, renderedHeight: ans.getBoundingClientRect().height };
  });
}

console.log(JSON.stringify(result, null, 2));
await browser.close();
