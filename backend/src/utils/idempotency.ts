import { randomUUID } from 'crypto';

/**
 * Phase 1 placeholder for idempotency-key handling.
 * Full business-key deduplication lands in Phase 5/6 (orders/payments/webhooks).
 */
export function getIdempotencyKey(headerValue: unknown): string | null {
  if (typeof headerValue !== 'string') return null;
  const trimmed = headerValue.trim();
  return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null;
}

export function newRequestId(): string {
  return `req_${randomUUID()}`;
}
