/** Content-free diagnostics. Never persist error messages, response bodies or headers. */
export function safeStreamError(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const names = ['AI_APICallError', 'AI_RetryError', 'AI_InvalidToolArgumentsError', 'AI_ToolExecutionError',
    'AI_NoSuchToolError', 'AI_TypeValidationError', 'AI_JSONParseError', 'AbortError', 'TypeError'];
  const codes = ['invalid_api_key', 'authentication_error', 'invalid_request_error', 'rate_limit_exceeded',
    'context_length_exceeded', 'server_error', 'model_not_found', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
    'ENOTFOUND', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'];
  const cause = value.cause && typeof value.cause === 'object' ? value.cause as Record<string, unknown> : {};
  let bodyCode: unknown;
  if (typeof value.responseBody === 'string' && value.responseBody.length <= 5000) {
    try { bodyCode = JSON.parse(value.responseBody)?.error?.code; } catch { /* no diagnostic evidence */ }
  }
  const code = [value.code, cause.code, bodyCode].find((candidate): candidate is string =>
    typeof candidate === 'string' && codes.includes(candidate)) ?? null;
  const status = typeof value.statusCode === 'number' && Number.isInteger(value.statusCode)
    && value.statusCode >= 100 && value.statusCode <= 599 ? value.statusCode : null;
  return { upstreamErrorObserved: true,
    upstreamErrorCategory: typeof value.name === 'string' && names.includes(value.name) ? value.name : 'unknown',
    upstreamErrorCode: code, upstreamHttpStatus: status };
}

export type StreamTerminalDiagnostics = {
  streamTerminalFrameSeen: boolean; streamTerminalFrameMissing: boolean;
  streamWireFinishReason: string | null; streamReadFailed: boolean; streamErrorFrameSeen: boolean;
};

/** Bounded schema coordinates only; never arguments, validation messages or unknown keys. */
export function safeToolArgumentIssues(error: unknown): Array<{ field: string; code: string }> {
  const fields = new Set(['title', 'language', 'slides', 'subtitle', 'variant', 'layout', 'blocks',
    'kind', 'text', 'items', 'rows', 'markdown', 'columns', 'sheets', 'name', 'values', 'series',
    'chartType', 'categories', 'content']);
  const codes = new Set(['invalid_type', 'invalid_enum_value', 'too_small', 'too_big', 'unrecognized_keys',
    'invalid_union', 'invalid_string', 'custom']);
  let candidate: unknown = error;
  for (let depth = 0; depth < 4; depth++) {
    if (!candidate || typeof candidate !== 'object') break;
    const value = candidate as Record<string, unknown>;
    if (Array.isArray(value.issues)) return value.issues.slice(0, 8).map((issue: unknown) => {
      const entry = issue && typeof issue === 'object' ? issue as Record<string, unknown> : {};
      const path = Array.isArray(entry.path) ? entry.path.slice(0, 6) : [];
      return { field: path.map(segment => typeof segment === 'number' ? '[]'
        : typeof segment === 'string' && fields.has(segment) ? segment : 'unknown_field').join('.') || 'input',
      code: typeof entry.code === 'string' && codes.has(entry.code) ? entry.code : 'validation_error' };
    });
    candidate = value.cause;
  }
  return [];
}
