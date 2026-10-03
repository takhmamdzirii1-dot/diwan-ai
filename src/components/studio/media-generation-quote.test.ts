import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { generationAction, parseGenerationQuote, type GenerationQuote } from './media-generation-quote';

const ready = parseGenerationQuote({ credits: 25, balance: 100, allowanceRemaining: null, canGenerate: true });
const action = (quote: GenerationQuote = ready) => ({ prompt: 'A scene', modelId: 'selected-model', available: true, generating: false, quote });

test('authoritative quote distinguishes zero, unknown and server-confirmed Included', () => {
  assert.equal(parseGenerationQuote(null).status, 'unknown');
  for (const credits of [undefined, NaN, Infinity, -1, 1.5]) assert.equal(parseGenerationQuote({ credits, balance: 100, canGenerate: true }).status, 'unknown');
  assert.deepEqual(parseGenerationQuote({ credits: 0, balance: 0, canGenerate: true, allowanceRemaining: 4 }), { status: 'ready', credits: 0, balance: 0, canGenerate: true, included: true });
  assert.deepEqual(parseGenerationQuote({ credits: 0, balance: 0, canGenerate: true }), { status: 'ready', credits: 0, balance: 0, canGenerate: true, included: false });
});

test('both pages use the same fail-closed submission decision including keyboard and regenerate', () => {
  assert.equal(generationAction(action()).canGenerate, true);
  for (const patch of [{ prompt: ' \n\t' }, { modelId: undefined }, { generating: true }, { sourceMissing: true }, { available: false }, { quote: { status: 'unknown' } as GenerationQuote }, { quote: { status: 'loading' } as GenerationQuote }]) {
    assert.equal(generationAction({ ...action(), ...patch }).canGenerate, false);
  }
  for (const file of ['ImageCanvas.tsx', 'PrunaMotionStudio.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /if \(!generationAction\(action\)\.canGenerate\) return null/);
    assert.match(source, /event\.key === 'Enter' && !generationAction\(action\)\.canGenerate/);
    assert.match(source, /<MediaGenerate \{\.\.\.action\}/);
    assert.match(source, /useGenerationQuote/);
  }
});

test('insufficient balance chooses top-up rather than a generation; Included needs no wallet', () => {
  const insufficient = parseGenerationQuote({ credits: 25, balance: 10, allowanceRemaining: null, canGenerate: false });
  assert.deepEqual(generationAction(action(insufficient)), { reason: null, insufficient: true, canGenerate: false });
  assert.equal(generationAction({ ...action(insufficient), prompt: ' ' }).reason, 'prompt');
  assert.equal(generationAction(action(parseGenerationQuote({ credits: 0, balance: 0, allowanceRemaining: 1, canGenerate: true }))).canGenerate, true);
  assert.equal(generationAction(action(parseGenerationQuote({ credits: 0, balance: 0, canGenerate: false }))).reason, 'unavailable');
});

test('new model/options/account or completion invalidates the prior quote immediately, late responses cannot replace it', () => {
  const source = readFileSync(new URL('media-generation-quote.ts', import.meta.url), 'utf8');
  assert.match(source, /JSON\.stringify\(\[modality, modelId, options, accountId, generating\]\)/);
  assert.match(source, /snapshot\?\.key === key/);
  assert.match(source, /!controller\.signal\.aborted/);
  assert.match(source, /return \(\) => controller\.abort\(\)/);
});

test('disabled, responsive and localized button contract uses existing tokens only', () => {
  const css = readFileSync(new URL('MediaGenerate.module.css', import.meta.url), 'utf8');
  const component = readFileSync(new URL('MediaGenerate.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.match(css, /white-space: nowrap/);
  assert.match(css, /:not\(:disabled\):hover/);
  assert.match(css, /:disabled.*studio-surface-raised.*studio-text-secondary.*not-allowed/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(component, /disabled=\{disabled\} aria-disabled=\{disabled\}/);
  assert.match(component, /Included/); assert.match(component, /Inclus/); assert.match(component, /مشمول/);
  assert.match(component, /aria-label=\{c.loading\}/);
});

test('the rendered shared button exposes price, skeleton, Included and top-up states in EN/FR/AR', async () => {
  const hooks = registerHooks({ load(url, context, next) {
    return url.endsWith('MediaGenerate.module.css') ? { format: 'module', shortCircuit: true, source: 'export default {}' } : next(url, context);
  } });
  try {
    const { default: Generate } = await import('./MediaGenerate');
    const render = (quote: GenerationQuote, locale = 'en', prompt = 'A scene') => renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale, messages: {}, timeZone: 'UTC',
      children: React.createElement(Generate, { ...action(quote), prompt, label: 'Generate', onAddCredits() {} }) }));
    assert.match(render(ready), /25<\/bdi> credits/);
    assert.match(render(ready, 'en', ' '), /disabled="" aria-disabled="true"/);
    assert.match(render({ status: 'loading' }), /aria-label="Checking price…"/);
    assert.doesNotMatch(render({ status: 'unknown' }), /0<\/bdi> credits/);
    assert.match(render(parseGenerationQuote({ credits: 25, balance: 10, canGenerate: false })), /Add credits/);
    assert.match(render(parseGenerationQuote({ credits: 25, balance: 10, canGenerate: false })), /Needs 25, you have 10/);
    const included = parseGenerationQuote({ credits: 0, balance: 0, allowanceRemaining: 4, canGenerate: true });
    for (const [locale, text] of [['en', 'Included'], ['fr', 'Inclus'], ['ar', 'مشمول']]) assert.ok(render(included, locale).includes(text));
  } finally { hooks.deregister(); }
});

test('button/helper token pairs meet AA in Neutral, OLED and Warm', () => {
  const css = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8');
  const luminance = (hex: string) => {
    const channels = hex.match(/[0-9a-f]{2}/gi)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const base = css.match(/\.studio-overlay-root\[data-studio-theme\] \{([^}]+)/)![1];
  for (const theme of [base, base + css.match(/data-studio-theme="oled"\] \{([^}]+)/)![1], base + css.match(/data-studio-theme="warm"\] \{([^}]+)/)![1]]) {
    const token = (name: string) => [...theme.matchAll(new RegExp(`--studio-${name}: (#[a-f0-9]+)`, 'g'))].at(-1)?.[1];
    const background = token('composer')!;
    const contrast = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    assert.ok(contrast(token('text-secondary')!, background) >= 4.5);
    assert.ok(contrast(token('accent')!, token('accent-contrast')!) >= 4.5);
  }
});
