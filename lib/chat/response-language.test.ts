import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveResponseLanguage } from './response-language';

test('current Arabic turn wins over English source context and technical model names', () => {
  assert.equal(resolveResponseLanguage('ما هو latest version of Node.js الآن؟', ['What is Node.js?'], 'en'), 'ar');
  assert.equal(resolveResponseLanguage('ما أخبار OpenAI GPT-5.6 اليوم؟', [], 'fr'), 'ar');
});

test('French and English current turns set response language independently of sources', () => {
  assert.equal(resolveResponseLanguage('Quelle est la dernière version de Node.js ?', ['What is Node.js?'], 'en'), 'fr');
  assert.equal(resolveResponseLanguage('What is the latest version of Node.js?', ['ما هو الإصدار؟'], 'ar'), 'en');
});

test('explicit user instruction outranks script, and ambiguous turns inherit only user conversation', () => {
  assert.equal(resolveResponseLanguage('ما هو إصدار Node.js؟ Answer in English.', [], 'ar'), 'en');
  assert.equal(resolveResponseLanguage('What is the update? Réponds en français.', [], 'en'), 'fr');
  assert.equal(resolveResponseLanguage('ترجم هذه الفقرة إلى الإنجليزية', [], 'ar'), 'en');
  assert.equal(resolveResponseLanguage('Parle-moi de GPT-5.6', [], 'en'), 'fr');
  assert.equal(resolveResponseLanguage('And now?', ['Quelle est la version actuelle ?'], 'en'), 'fr');
  assert.equal(resolveResponseLanguage('GPT-5.6', [], 'ar'), 'ar');
});
