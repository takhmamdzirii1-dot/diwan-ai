import 'server-only';

/** Server-log-only, allowlisted diagnostics. Never include values or account data. */
export function connectedAppConfiguration(env: Record<string, string | undefined> = process.env) {
  const keys = ['PROVIDER_TOKEN_ENCRYPTION_KEY', 'GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET',
    'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GITHUB_CONNECTED_APP_CLIENT_ID', 'GITHUB_CONNECTED_APP_CLIENT_SECRET',
    'CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'GOOGLE_WORKSPACE_CLIENT_ID', 'GOOGLE_WORKSPACE_CLIENT_SECRET'] as const;
  const prerequisites = Object.fromEntries(keys.map(name => [name, {
    present: Boolean(env[name]), nonBlank: Boolean(env[name]?.trim()),
  }]));
  const flags = Object.fromEntries(['CONNECTED_APPS_WRITES_ENABLED', 'CONNECTED_APPS_WOOCOMMERCE_ENABLED'].map(name => [name, {
    present: Boolean(env[name]), enabled: env[name] === 'true',
    valid: env[name] === undefined || env[name] === 'true' || env[name] === 'false',
  }]));
  const encryption = Boolean(env.PROVIDER_TOKEN_ENCRYPTION_KEY);
  const reason = (prefix: string, writes = false) => !encryption ? 'encryption_missing'
    : !env[`${prefix}_CLIENT_ID`] ? 'client_id_missing'
      : !env[`${prefix}_CLIENT_SECRET`] ? 'client_secret_missing'
        : writes && env.CONNECTED_APPS_WRITES_ENABLED !== 'true' ? 'writes_disabled' : null;
  return { prerequisites, flags, disabledReasons: {
    google_drive: reason('GOOGLE_DRIVE'), gmail: reason('GMAIL'), github: reason('GITHUB_CONNECTED_APP'),
    canva: reason('CANVA'), google_workspace: reason('GOOGLE_WORKSPACE', true),
    woocommerce: !encryption ? 'encryption_missing' : env.CONNECTED_APPS_WRITES_ENABLED !== 'true' ? 'writes_disabled'
      : env.CONNECTED_APPS_WOOCOMMERCE_ENABLED !== 'true' ? 'onboarding_disabled' : null,
    shopify: 'privacy_uninstall_webhooks_not_implemented', meta: 'adapter_not_implemented', whatsapp: 'adapter_not_implemented',
  } };
}

let lastConfiguration: string | undefined;
export function logConnectedAppConfiguration() {
  const summary = JSON.stringify(connectedAppConfiguration());
  if (summary !== lastConfiguration) {
    lastConfiguration = summary;
    console.info('CONNECTED_APPS_CONFIGURATION', summary);
  }
}
