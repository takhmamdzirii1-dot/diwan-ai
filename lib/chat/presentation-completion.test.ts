import assert from 'node:assert/strict';
import test from 'node:test';
import { runArtifactTool } from '@/lib/artifacts/tool-registry';
import { requestedPresentationSlideCount } from '@/lib/artifacts/chat-parts';
import { presentationCompletion } from './presentation-completion';

const six = runArtifactTool('create_presentation', { title: 'Sales', slides: Array.from({ length: 6 }, (_, index) => ({
  title: `Slide ${index + 1}`, variant: index === 0 ? 'cover' : 'insights',
  blocks: index === 0 ? [] : [{ kind: 'bullets', items: ['Sales improved.'] }],
})) });
assert.equal(six.status, 'ok');
if (six.status !== 'ok' || six.artifact.type !== 'presentation') throw new Error('Invalid fixture');
const presentation = six.artifact;

test('tool-only six-slide presentation is visible success with zero assistant text', () => {
  const result = presentationCompletion('', [{ type: 'presentation', artifact: presentation }], 6, 'en');
  assert.equal(result.valid, true);
  assert.equal(result.text, '');
  assert.equal(result.artifacts[0].type, 'presentation');
});

test('structured fallback uses the validated presentation part and hides internal JSON', () => {
  const result = presentationCompletion(JSON.stringify(presentation), [], 6, 'en');
  assert.equal(result.valid, true);
  assert.equal(result.text, '');
  assert.equal(result.artifacts[0].type, 'presentation');
});

test('one slide and zero output cannot satisfy a six-slide request', () => {
  const one = { ...presentation, slides: presentation.slides.slice(0, 1) };
  assert.equal(presentationCompletion('', [{ type: 'presentation', artifact: one }], 6, 'en').valid, false);
  assert.equal(presentationCompletion(JSON.stringify(one), [], 6, 'en').valid, false);
  assert.equal(presentationCompletion('', [], 6, 'en').valid, false);
});

test('normal Chat output remains unchanged when no slide count was requested', () => {
  assert.deepEqual(presentationCompletion('Compound interest grows over time.', [], null, 'en'),
    { text: 'Compound interest grows over time.', artifacts: [], valid: true });
});

test('bounded explicit slide counts remain deterministic across supported prompt languages', () => {
  assert.equal(requestedPresentationSlideCount('Build a 6-slide presentation.'), 6);
  assert.equal(requestedPresentationSlideCount('Créez une présentation de 6 diapositives.'), 6);
  assert.equal(requestedPresentationSlideCount('أنشئ عرضًا تقديميًا من 6 شرائح.'), 6);
  assert.equal(requestedPresentationSlideCount('What is compound interest?'), null);
});
