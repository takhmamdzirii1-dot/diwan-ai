import type { ConnectedAppAdapter } from './core';

/** Explicitly labeled fixture connector; not registered for customers by default. */
export function referenceFilesAdapter(): ConnectedAppAdapter {
  return {
    id: 'vantra_example_files', name: 'Example Files (test connector)', authorization: 'reference',
    actions: [{ id: 'read_example_file', description: 'Read the example project note.',
      classification: 'read', risk: 'low', requiredScopes: ['files.read'],
      requiresConnection: true, requiresConfirmation: false,
      matches: (request) => /\bexample (?:project )?files?\b|ملف تجريبي/i.test(request),
    }],
    connect: async () => ({ scopes: ['files.read'] }),
    execute: async ({ actionId }) => {
      if (actionId !== 'read_example_file') throw new Error('resource_not_found');
      return { sourceId: 'example-project-note', name: 'Example project note', mimeType: 'text/markdown',
        text: '# Example project note\n\nThis is a deterministic test resource, not a customer file.' };
    },
  };
}
