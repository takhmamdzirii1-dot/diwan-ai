import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const baseUrl = process.env.VANTRA_BASE_URL ?? 'http://127.0.0.1:3000';
const executablePath =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const locales = {
  fr: {dir: 'ltr', title: 'VANTRA | Un espace IA pour le Chat, l’Image et la Vidéo'},
  ar: {dir: 'rtl', title: 'VANTRA | مساحة ذكاء اصطناعي للدردشة والصور والفيديو'},
  en: {dir: 'ltr', title: 'VANTRA | One AI workspace for Chat, Image and Video'}
};
const widths = [1440, 1280, 1024, 768, 430, 390];
const screenshotDirectory = path.join(os.tmpdir(), 'vantra-i18n-verification');

await fs.mkdir(screenshotDirectory, {recursive: true});

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const failures = [];
const observations = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function shapeOf(value) {
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shapeOf(value[key])]));
  }
  return typeof value;
}

const catalogShapes = await Promise.all(
  Object.keys(locales).map(async (locale) => {
    const catalog = JSON.parse(await fs.readFile(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    return JSON.stringify(shapeOf(catalog));
  })
);
assert(new Set(catalogShapes).size === 1, 'FR/AR/EN dictionary shapes do not match');

const rootResponse = await fetch(`${baseUrl}/`, {
  redirect: 'manual',
  headers: {'Accept-Language': 'ar-DZ,ar;q=0.9'}
});
assert(rootResponse.status >= 300 && rootResponse.status < 400, `Root resolver returned ${rootResponse.status}`);
assert(rootResponse.headers.get('location')?.endsWith('/ar'), `Root resolver Location is ${rootResponse.headers.get('location')}`);
assert(rootResponse.headers.get('cache-control')?.includes('no-store'), 'Root resolver is missing no-store');
const vary = rootResponse.headers.get('vary')?.toLowerCase() ?? '';
assert(vary.includes('cookie') && vary.includes('accept-language'), `Root resolver Vary is ${vary}`);
const unsupportedResponse = await fetch(`${baseUrl}/de`, {redirect: 'manual'});
assert(unsupportedResponse.status === 404, `Unsupported locale returned ${unsupportedResponse.status}`);
const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
const sitemap = await sitemapResponse.text();
assert(sitemapResponse.ok, `Sitemap returned ${sitemapResponse.status}`);
for (const locale of Object.keys(locales)) {
  assert(sitemap.includes(`/${locale}`), `Sitemap is missing /${locale}`);
}
assert(sitemap.includes('x-default'), 'Sitemap is missing x-default');

try {
  for (const [locale, expected] of Object.entries(locales)) {
    for (const width of widths) {
      const page = await browser.newPage();
      const runtimeErrors = [];
      const blockedExternalHosts = new Set();
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
          runtimeErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      page.on('requestfailed', (request) => {
        const url = new URL(request.url());
        if (url.origin === baseUrl) {
          runtimeErrors.push(`${request.failure()?.errorText}: ${url.pathname}`);
        } else {
          blockedExternalHosts.add(url.host);
        }
      });
      await page.setViewport({width, height: width >= 768 ? 900 : 844, deviceScaleFactor: 1});
      const response = await page.goto(`${baseUrl}/${locale}`, {waitUntil: 'networkidle0'});
      const result = await page.evaluate(() => {
        const canonical = document.querySelector('link[rel="canonical"]')?.href;
        const alternates = [...document.querySelectorAll('link[rel="alternate"]')].map((link) => ({
          hreflang: link.getAttribute('hreflang'),
          href: link.href
        }));
        const faq = document.querySelector('#faq');
        const pricing = document.querySelector('#pricing');
        const switchLinks = [...document.querySelectorAll('a')]
          .filter((link) => /\/(fr|ar|en)$/.test(new URL(link.href).pathname))
          .map((link) => new URL(link.href).pathname);
        return {
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          title: document.title,
          canonical,
          alternates,
          hasFaq: Boolean(faq),
          hasPricing: Boolean(pricing),
          switchLinks,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          heading: document.querySelector('h1')?.textContent?.trim(),
          headerHeight: document.querySelector('header')?.getBoundingClientRect().height,
          heroHeadingSize: document.querySelector('h1')
            ? getComputedStyle(document.querySelector('h1')).fontSize
            : null
        };
      });

      assert(response?.ok(), `${locale}/${width}: HTTP ${response?.status()}`);
      assert(result.lang === locale, `${locale}/${width}: html lang is ${result.lang}`);
      assert(result.dir === expected.dir, `${locale}/${width}: html dir is ${result.dir}`);
      assert(result.title === expected.title, `${locale}/${width}: unexpected title`);
      assert(result.canonical?.endsWith(`/${locale}`), `${locale}/${width}: bad canonical`);
      for (const hreflang of ['fr', 'ar', 'en', 'x-default']) {
        assert(
          result.alternates.some((item) => item.hreflang === hreflang),
          `${locale}/${width}: missing ${hreflang} alternate`
        );
      }
      assert(result.hasFaq && result.hasPricing, `${locale}/${width}: required section missing`);
      assert(
        ['/fr', '/ar', '/en'].every((route) => result.switchLinks.includes(route)),
        `${locale}/${width}: language switch routes missing`
      );
      assert(
        result.documentWidth <= result.viewportWidth && result.bodyWidth <= result.viewportWidth,
        `${locale}/${width}: horizontal overflow ${Math.max(result.documentWidth, result.bodyWidth)} > ${result.viewportWidth}`
      );
      assert(runtimeErrors.length === 0, `${locale}/${width}: runtime errors: ${runtimeErrors.join(' | ')}`);

      if (width === 1440 || width === 390) {
        await page.evaluate(async () => {
          for (let top = 0; top <= document.documentElement.scrollHeight; top += window.innerHeight * 0.75) {
            window.scrollTo({top, behavior: 'instant'});
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
          window.scrollTo({top: 0, behavior: 'instant'});
        });
        await page.screenshot({
          path: path.join(screenshotDirectory, `${locale}-${width}.png`),
          fullPage: true
        });
      }

      observations.push({
        locale,
        width,
        heading: result.heading,
        headerHeight: result.headerHeight,
        heroHeadingSize: result.heroHeadingSize,
        blockedExternalHosts: [...blockedExternalHosts].join(', ') || 'none'
      });
      await page.close();
    }
  }

  const faqPage = await browser.newPage();
  await faqPage.goto(`${baseUrl}/ar#faq`, {waitUntil: 'networkidle0'});
  const secondFaq = await faqPage.$('#faq-trigger-1');
  assert(Boolean(secondFaq), 'Arabic FAQ: second trigger not found');
  if (secondFaq) {
    await secondFaq.click();
    const expanded = await faqPage.$eval('#faq-trigger-1', (element) => element.getAttribute('aria-expanded'));
    const labelledBy = await faqPage.$eval('#faq-panel-1', (element) => element.getAttribute('aria-labelledby'));
    assert(expanded === 'true', `Arabic FAQ: aria-expanded is ${expanded}`);
    assert(labelledBy === 'faq-trigger-1', `Arabic FAQ: aria-labelledby is ${labelledBy}`);
  }
  await faqPage.close();

  const switcherContext = await browser.createBrowserContext();
  const switcherPage = await switcherContext.newPage();
  await switcherPage.setViewport({width: 390, height: 844, deviceScaleFactor: 1});
  await switcherPage.goto(`${baseUrl}/fr#pricing`, {waitUntil: 'networkidle0'});
  await switcherPage.click('button[aria-controls="vantra-mobile-menu"]');
  await switcherPage.waitForSelector('#vantra-mobile-menu', {visible: true});
  const visibleLocaleRoutes = await switcherPage.$$eval(
    '#vantra-mobile-menu a',
    (links) => links.filter((link) => link.getClientRects().length > 0).map((link) => new URL(link.href).pathname)
  );
  for (const route of ['/fr', '/ar', '/en']) {
    assert(visibleLocaleRoutes.includes(route), `Mobile switcher is missing visible ${route}`);
  }
  await Promise.all([
    switcherPage.waitForNavigation({waitUntil: 'networkidle0'}),
    switcherPage.click('#vantra-mobile-menu a[href^="/ar"]')
  ]);
  const switcherCookie = (await switcherPage.cookies()).find((cookie) => cookie.name === 'vantra_locale');
  assert(new URL(switcherPage.url()).pathname === '/ar', `Manual switch went to ${switcherPage.url()}`);
  assert(new URL(switcherPage.url()).hash === '#pricing', `Manual switch lost the section hash: ${switcherPage.url()}`);
  assert(switcherCookie?.value === 'ar', `Manual switch saved ${switcherCookie?.value}`);
  await switcherPage.goto(`${baseUrl}/`, {waitUntil: 'networkidle0'});
  assert(new URL(switcherPage.url()).pathname === '/ar', `Saved manual choice was not remembered: ${switcherPage.url()}`);
  await switcherContext.close();

  const redirectCases = [
    {label: 'unsupported browser language', acceptLanguage: 'de-DE,de;q=0.9', expected: '/fr'},
    {label: 'Arabic browser language', acceptLanguage: 'ar-DZ,ar;q=0.9', expected: '/ar'},
    {label: 'English browser language', acceptLanguage: 'en-US,en;q=0.9', expected: '/en'}
  ];
  for (const testCase of redirectCases) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({'Accept-Language': testCase.acceptLanguage});
    await page.goto(`${baseUrl}/`, {waitUntil: 'networkidle0'});
    assert(new URL(page.url()).pathname === testCase.expected, `Root redirect (${testCase.label}) went to ${page.url()}`);
    await context.close();
  }

  const preferenceContext = await browser.createBrowserContext();
  await preferenceContext.setCookie({name: 'vantra_locale', value: 'en', url: baseUrl});
  const preferencePage = await preferenceContext.newPage();
  await preferencePage.setExtraHTTPHeaders({'Accept-Language': 'ar-DZ,ar;q=0.9'});
  await preferencePage.goto(`${baseUrl}/`, {waitUntil: 'networkidle0'});
  assert(new URL(preferencePage.url()).pathname === '/en', `Saved preference did not win: ${preferencePage.url()}`);
  await preferencePage.goto(`${baseUrl}/ar`, {waitUntil: 'networkidle0'});
  assert(new URL(preferencePage.url()).pathname === '/ar', `Explicit locale route was redirected: ${preferencePage.url()}`);
  const savedLocale = (await preferencePage.cookies()).find((cookie) => cookie.name === 'vantra_locale');
  assert(savedLocale?.value === 'ar', `Explicit locale did not update cookie: ${savedLocale?.value}`);
  await preferenceContext.close();

  const ctaPage = await browser.newPage();
  await ctaPage.goto(`${baseUrl}/ar`, {waitUntil: 'networkidle0'});
  const clickedCta = await ctaPage.evaluate(() => {
    const candidates = [...document.querySelectorAll('button')].filter((button) =>
      button.textContent?.includes('ابدأ مع VANTRA')
    );
    const button = candidates.at(-1);
    button?.click();
    return Boolean(button);
  });
  assert(clickedCta, 'Arabic final CTA button was not found');
  if (clickedCta) {
    await ctaPage.waitForSelector('[role="dialog"]', {visible: true});
    const dialog = await ctaPage.$eval('[role="dialog"]', (element) => ({
      labelledBy: element.getAttribute('aria-labelledby'),
      title: document.getElementById(element.getAttribute('aria-labelledby') ?? '')?.textContent?.trim()
    }));
    assert(dialog.labelledBy === 'vantra-auth-modal-title', `Auth dialog label is ${dialog.labelledBy}`);
    assert(dialog.title === 'أنشئ حسابك في VANTRA', `Arabic auth dialog title is ${dialog.title}`);
  }
  await ctaPage.close();

  const studioPage = await browser.newPage();
  const studioResponse = await studioPage.goto(`${baseUrl}/studio`, {waitUntil: 'domcontentloaded'});
  const studioDocument = await studioPage.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    title: document.title
  }));
  assert(studioResponse?.ok(), `Studio returned ${studioResponse?.status()}`);
  assert(studioDocument.lang === 'en' && studioDocument.dir === 'ltr', `Studio document is ${studioDocument.lang}/${studioDocument.dir}`);
  assert(studioDocument.title === 'VANTRA Studio', `Studio title is ${studioDocument.title}`);
  await studioPage.close();
} finally {
  await browser.close();
}

console.log(`Checked ${Object.keys(locales).length * widths.length} locale/viewport combinations.`);
console.log(`Screenshots: ${screenshotDirectory}`);
console.table(observations);

if (failures.length) {
  console.error('\nVerification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\nAll localization checks passed.');
}
