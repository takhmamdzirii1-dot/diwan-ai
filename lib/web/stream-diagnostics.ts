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
