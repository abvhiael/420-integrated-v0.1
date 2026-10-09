export const GENERATION_ERROR_CODES_420 = Object.freeze([
  "INVALID_REQUEST",
  "INVALID_CLIENT_REQUEST_ID",
  "REFERENCE_AUDIO_NOT_AUTHORIZED",
  "UNSUPPORTED_CAPABILITY",
  "NO_CAPACITY",
  "QUOTE_EXPIRED",
  "QUOTE_MISMATCH",
  "REPLAY_CONFLICT",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_REJECTED",
  "TIMEOUT",
  "CANCELLED",
  "MALFORMED_RESULT",
  "INTEGRITY_MISMATCH",
  "INTERNAL_ERROR"
]);

const RETRYABLE = new Set([
  "NO_CAPACITY",
  "PROVIDER_UNAVAILABLE",
  "TIMEOUT"
]);

export class GenerationError420 extends Error {
  constructor(code, message, {
    retryable = RETRYABLE.has(code),
    providerCode = null,
    cause = undefined,
    details = null
  } = {}) {
    if (!GENERATION_ERROR_CODES_420.includes(code)) {
      throw new TypeError(`unknown generation error code: ${code}`);
    }
    super(message, cause === undefined ? undefined : { cause });
    this.name = "GenerationError420";
    this.code = code;
    this.retryable = Boolean(retryable);
    this.providerCode = providerCode;
    this.details = details;
  }
}

export function normalizeProviderError420(error) {
  if (error instanceof GenerationError420) return error;

  const providerCode = error?.code ?? error?.name ?? null;
  if (error?.transient === true || providerCode === "ETIMEDOUT" || providerCode === "ECONNRESET") {
    return new GenerationError420(
      "PROVIDER_UNAVAILABLE",
      "generation provider is temporarily unavailable",
      { retryable: true, providerCode, cause: error }
    );
  }

  return new GenerationError420(
    "PROVIDER_REJECTED",
    "generation provider rejected the operation",
    { retryable: false, providerCode, cause: error }
  );
}
