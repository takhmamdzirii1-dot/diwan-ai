import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedActionCandidates } from './core';
import { gmailAdapter } from './gmail';
import { googleWorkspaceAdapter } from './google-workspace';
import { googleDriveAdapter } from './google-drive';
import { connectedReadTool } from './native';
import { connectedReviewIds } from './review-reference';
import { serializeChatSession } from '@/lib/chat/message-history';

test('private domain selects one connector; selected model chooses read or draft, not a prompt phrase gate', async () => {
  const previous = process.env.CONNECTED_APPS_WRITES_ENABLED;
  process.env.CONNECTED_APPS_WRITES_ENABLED = 'true';
  try {
    const apps = [gmailAdapter(), googleWorkspaceAdapter(), googleDriveAdapter()];
    for (const request of ['Find the email with subject "two" and show only sender and subject.',
      'Show the sender of the email titled two', 'اعرض رسائل البريد الواردة', 'Cherche le courriel avec le sujet deux',
      'Write an email to contact@joinvantra.com for review',
      'Create a draft to contact@joinvantra.com with subject VANTRA Draft Verification and body: Gmail compose scope verified. Do not send it.']) {
      const candidates = connectedActionCandidates(request, apps);
      assert.deepEqual(candidates.map(item => item.action.id), ['search_gmail', 'draft_gmail']);
    }
    const request = 'Create a draft to contact@joinvantra.com with subject VANTRA Draft Verification and body: Gmail compose scope verified. Do not send it.';
    const candidates = connectedActionCandidates(request, apps);
    let proposal = 0;
    const reviewId = crypto.randomUUID();
    const tool = connectedReadTool({ match: candidates[0], candidates, request, userId: 'owner', signal: new AbortController().signal,
      load: async () => ({ connection: null, credential: null }), prepare: async (args, match) => {
        assert.equal(match?.action.id, 'draft_gmail'); assert.equal(args.to, 'contact@joinvantra.com'); proposal++;
        return { sourceId: reviewId, name: 'Pending', mimeType: 'text/plain', text: 'Review the exact draft.' };
      } });
    const args = tool.parameters.parse({ actionId: 'draft_gmail', arguments: { to: 'contact@joinvantra.com', subject: 'VANTRA Draft Verification', body: 'Gmail compose scope verified.' } });
    const result = await tool.execute!(args);
    assert.equal(proposal, 1);
    const message = { role: 'assistant', content: 'Awaiting approval.', toolInvocations: [{ toolName: 'read_connected_file', state: 'result', result }] };
    const restored = JSON.parse(serializeChatSession([message], () => []))[0];
    assert.deepEqual(connectedReviewIds(restored), [reviewId]);
    assert.deepEqual(connectedReviewIds({ toolInvocations: [{ ...message.toolInvocations[0], result: { status: 'review_required', reviewId: 'not-a-uuid' } }] }), []);
    assert.throws(() => tool.parameters.parse({ actionId: 'send_gmail', arguments: args.arguments }));
    assert.equal(connectedActionCandidates('Create a Google Sheet named VANTRA Verification Sheet and set A1=Status and B1=Connected.', apps)[0].adapter.id, 'google_workspace');
    assert.equal(connectedActionCandidates('Read https://docs.google.com/document/d/authorized-document-123/edit', apps)[0].adapter.id, 'google_drive');
    for (const request of ['Explain photosynthesis', 'I use Gmail', 'Explain how Gmail works', 'Show an example email', 'Do not read Gmail',
      'Show my Gmail setup but do not read the mailbox', 'Create a draft but do not create it in Gmail'])
      assert.equal(connectedActionCandidates(request, apps).length, 0);
  } finally { if (previous === undefined) delete process.env.CONNECTED_APPS_WRITES_ENABLED; else process.env.CONNECTED_APPS_WRITES_ENABLED = previous; }
});
