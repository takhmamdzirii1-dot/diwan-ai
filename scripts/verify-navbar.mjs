import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const out = {};

// ── Desktop ──
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
out.desktop = await p.evaluate(() => {
  const header = document.querySelector('header');
  const links = [...header.querySelectorAll('nav[aria-label="Primary"] a')].map(a => a.textContent.trim());
  const btn = (t) => [...header.querySelectorAll('button')].some(x => x.textContent.trim() === t);
  const style = getComputedStyle(header);
  return {
    links,
    signIn: btn('Sign In'),
    startFree: btn('Start Free'),
    atTop: { bg: style.backgroundColor, border: style.borderBottomColor },
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    headerH: header.offsetHeight,
  };
});
// scrolled style
await p.evaluate(() => window.scrollTo({ top: 600 }));
await new Promise(r => setTimeout(r, 600));
out.desktop.scrolled = await p.evaluate(() => {
  const s = getComputedStyle(document.querySelector('header'));
  return { bg: s.backgroundColor, border: s.borderBottomColor, backdrop: s.backdropFilter };
});
// smooth scroll via FAQ link
await p.click('nav[aria-label="Primary"] a[href="#faq"]');
await new Promise(r => setTimeout(r, 1800));
out.desktop.faqScroll = await p.evaluate(() => {
  const r = document.getElementById('faq').getBoundingClientRect();
  return { faqTopInViewport: Math.round(r.top), scrollY: Math.round(window.scrollY) };
});
// active state: scroll to pricing
await p.evaluate(() => document.getElementById('pricing').scrollIntoView({ behavior: 'instant', block: 'start' }));
await p.evaluate(() => window.scrollBy(0, -200));
await new Promise(r => setTimeout(r, 900));
out.desktop.activeAfterScroll = await p.evaluate(() => {
  const cur = [...document.querySelectorAll('header nav[aria-label="Primary"] a')].filter(a => a.getAttribute('aria-current') === 'true');
  return cur.map(a => a.textContent.trim());
});

// ── Mobile ──
await p.setViewport({ width: 390, height: 844 });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
out.mobile = await p.evaluate(() => {
  const header = document.querySelector('header');
  const burger = header.querySelector('button[aria-controls="vantra-mobile-menu"]');
  return {
    desktopNavHidden: getComputedStyle(header.querySelector('nav[aria-label="Primary"]')).display === 'none',
    burgerAriaLabel: burger?.getAttribute('aria-label'),
    burgerVisible: !!burger && burger.offsetHeight > 0,
    compactStartFree: [...header.querySelectorAll('button')].some(x => x.textContent.trim() === 'Start Free' && x.offsetHeight > 0),
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
    headerH: header.offsetHeight,
  };
});
// open menu
await p.click('button[aria-controls="vantra-mobile-menu"]');
await new Promise(r => setTimeout(r, 500));
out.mobile.menuOpen = await p.evaluate(() => {
  const menu = document.getElementById('vantra-mobile-menu');
  const items = [...menu.querySelectorAll('a, button')].map(x => x.textContent.trim());
  const burger = document.querySelector('button[aria-controls="vantra-mobile-menu"]');
  return {
    visible: !!menu && menu.offsetHeight > 0,
    items,
    ariaExpanded: burger?.getAttribute('aria-expanded'),
    touchTargetsOk: [...menu.querySelectorAll('a')].every(a => a.getBoundingClientRect().height >= 44),
  };
});
// click FAQ in menu → closes + scrolls
await p.click('#vantra-mobile-menu a[href="#faq"]');
await new Promise(r => setTimeout(r, 1800));
out.mobile.afterFaqClick = await p.evaluate(() => {
  const menu = document.getElementById('vantra-mobile-menu');
  const r = document.getElementById('faq').getBoundingClientRect();
  return {
    menuClosed: !menu || menu.offsetHeight === 0,
    faqTopInViewport: Math.round(r.top),
    scrollY: Math.round(window.scrollY),
    bodyScrollable: document.documentElement.scrollHeight > window.innerHeight,
  };
});

console.log(JSON.stringify(out, null, 2));
await b.close();
