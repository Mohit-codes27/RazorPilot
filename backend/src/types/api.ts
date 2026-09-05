/** Shared API envelope + error-code contract (frontend-backend contract). */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_OUT_OF_STOCK'
  | 'CART_EMPTY'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ALREADY_PAID'
  | 'PAYMENT_INITIALIZATION_FAILED'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'INVALID_WEBHOOK_SIGNATURE'
  | 'DUPLICATE_WEBHOOK'
  | 'CONFIRMATION_REQUIRED'
  | 'PRICE_CHANGED'
  | 'CONFLICT'
  | 'PAYMENT_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'TOOL_EXECUTION_ERROR'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR';
