import assert from 'node:assert/strict';
import test from 'node:test';
import { chatPartsFromMessage, chatPartsFromToolInvocations } from './chat-parts';
import { buildNativeArtifactTools } from './tool-native.server';
import { artifactTaskInstruction, artifactToolProgress, getArtifactTool, resolveArtifactToolPath, runArtifactTool, selectArtifactTools, verifyArtifactToolResult } from './tool-registry';

test('stable registry names resolve and invalid inputs/results fail safely', () => {
  for (const name of ['create_table', 'create_chart', 'create_document', 'create_spreadsheet', 'create_presentation']) {
    assert.equal(getArtifactTool(name)?.name, name);
    assert.equal(getArtifactTool(name)?.risk, 'CREATE');
  }
  assert.equal(getArtifactTool('delete_all'), null);
  assert.equal(artifactToolProgress('create_presentation', 'ar'), 'جارٍ إنشاء العرض التقديمي…');
  assert.equal(runArtifactTool('create_table', { title: 'Bad', columns: ['A', 'B'], rows: [['one']], language: 'en' }).status, 'error');
  assert.equal(runArtifactTool('create_chart', { title: 'Bad', chartType: 'bar', categories: ['A'], series: [{ name: 'S', values: [Number.NaN] }] }).status, 'error');
  assert.equal(verifyArtifactToolResult('create_chart', { status: 'ok', artifact: { type: 'chart' } }), null);
});

test('table, chart, document, spreadsheet and presentation execute through Artifact Core', () => {
  const table = runArtifactTool('create_table', { title: 'Summary', columns: ['Metric', 'Value'], rows: [['Revenue', '1200']] });
  assert.equal(table.status, 'ok');
  if (table.status === 'ok') { assert.equal(table.artifact.type, 'document'); assert.ok(verifyArtifactToolResult('create_table', table)); }
  const chart = runArtifactTool('create_chart', { title: 'Trend', chartType: 'line', categories: ['Jan', 'Feb'], series: [{ name: 'Sales', values: [10, 20] }] });
  assert.equal(chart.status, 'ok');
  if (chart.status === 'ok') assert.equal(chart.artifact.type, 'chart');
  assert.equal(runArtifactTool('create_chart', { title: 'Bad', chartType: 'line', categories: ['Jan', 'Feb'], series: [{ name: 'Sales', values: [10] }] }).status, 'error');
  const document = runArtifactTool('create_document', { title: 'Brief', markdown: '# Brief\n\nA short note.' });
  assert.equal(document.status, 'ok');
  const sheet = runArtifactTool('create_spreadsheet', { title: 'Forecast', sheets: [{ name: 'Data', columns: ['Month', 'Sales'], rows: [['Jan', 10]] }] });
  assert.equal(sheet.status, 'ok');
  assert.equal(runArtifactTool('create_spreadsheet', { title: 'Bad', sheets: [{ name: 'Data', columns: ['A', 'B'], rows: [['only one']] }] }).status, 'error');
  const presentation = runArtifactTool('create_presentation', { title: 'Review', slides: [
    { title: 'Review', variant: 'cover', blocks: [] },
    { title: 'Metrics', variant: 'kpi', blocks: [{ kind: 'table', rows: [['Sales', '1200']] }] },
  ] });
  assert.equal(presentation.status, 'ok');
  if (presentation.status === 'ok' && presentation.artifact.type === 'presentation') {
    assert.equal(presentation.artifact.slides[0].layout, 'title');
    assert.equal(presentation.artifact.slides.length, 2);
  }
  assert.equal(runArtifactTool('create_presentation', { title: 'Bad', slides: [{ title: 'Empty', variant: 'insights', blocks: [] }] }).status, 'error');
  assert.equal(runArtifactTool('create_presentation', { title: 'Bad', slides: [{ title: 'Bad', blocks: [{ kind: 'video', url: 'x' }] }] }).status, 'error');
});

test('tool selection and skill hooks expose only task-relevant definitions', () => {
  assert.deepEqual(selectArtifactTools('Explain compound interest'), { names: [], skill: null });
  const deck = selectArtifactTools('Create a presentation from this spreadsheet');
  assert.deepEqual(deck, { names: ['create_presentation'], skill: 'presentation' });
  assert.equal(Object.keys(buildNativeArtifactTools(deck)).join(','), 'create_presentation');
  assert.doesNotMatch(artifactTaskInstruction({ names: [], skill: null }, 'fallback'), /presentation|spreadsheet/i);
  const analysis = selectArtifactTools('Analyze this spreadsheet');
  assert.deepEqual(analysis, { names: [], skill: 'spreadsheet-analysis' });
  assert.match(artifactTaskInstruction(analysis, 'fallback'), /bounded spreadsheet context/);
  assert.deepEqual(selectArtifactTools('Create a chart from this table').names, ['create_chart']);
  assert.deepEqual(selectArtifactTools('Create a document').names, ['create_document']);
});

test('Capability V2 chooses native, structured, or safe fallback without probing', async () => {
  const selection = selectArtifactTools('Create a table');
  const native = resolveArtifactToolPath(selection, { tools: { state: 'supported' }, structuredOutput: { state: 'unknown' } });
  const structured = resolveArtifactToolPath(selection, { tools: { state: 'unknown' }, structuredOutput: { state: 'supported' } });
  const fallback = resolveArtifactToolPath(selection, { tools: { state: 'unknown' }, structuredOutput: { state: 'unknown' } });
  assert.deepEqual([native, structured, fallback], ['native', 'structured', 'fallback']);
  const tools = buildNativeArtifactTools(selection);
  const nativeResult = await tools.create_table.execute?.({ title: 'Native', columns: ['Name'], rows: [['A']] });
  assert.equal((nativeResult as { status?: string })?.status, 'ok');
  assert.match(artifactTaskInstruction(selection, structured), /strict structured JSON/);
  assert.match(artifactTaskInstruction(selection, fallback), /Do not add prose/);
});

test('structured text and native tool results converge to validated Chat parts with zero AI calls', () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => { calls++; throw new Error('Unexpected AI request'); }) as typeof fetch;
  try {
    const input = { title: 'Sales', chartType: 'bar', categories: ['Jan'], series: [{ name: 'Sales', values: [42] }] };
    const structured = chatPartsFromMessage(JSON.stringify({ tool: 'create_chart', input }), 'en');
    assert.equal(structured[0].type, 'chart');
    const result = runArtifactTool('create_chart', input);
    const native = chatPartsFromToolInvocations([{ state: 'result', toolName: 'create_chart', result }], 'en');
    assert.equal(native[0].type, 'chart');
    const invalid = chatPartsFromMessage(JSON.stringify({ tool: 'create_chart', input: { ...input, series: [] } }), 'en');
    assert.equal(invalid[0].type, 'text');
    if (invalid[0].type === 'text') assert.doesNotMatch(invalid[0].text, /"tool"|"input"/);
    const forged = chatPartsFromToolInvocations([{ state: 'result', toolName: 'create_chart', result: { status: 'ok', artifact: { type: 'chart' } } }], 'en');
    assert.equal(forged[0].type, 'text');
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
