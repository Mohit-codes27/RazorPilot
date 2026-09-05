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

export class AppError extends Error {
  statusCode: number;
  code: ErrorCode;
  isOperational: boolean;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'AUTHENTICATION_ERROR', message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'AUTHORIZATION_ERROR', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, 'CONFLICT', message);
  }
}

export class PaymentError extends AppError {
  constructor(message = 'Payment failed') {
    super(402, 'PAYMENT_ERROR', message);
  }
}

export class AIServiceError extends AppError {
  constructor(message = 'AI service unavailable') {
    super(503, 'AI_SERVICE_ERROR', message);
  }
}

export class ToolExecutionError extends AppError {
  constructor(message = 'Tool execution failed') {
    super(500, 'TOOL_EXECUTION_ERROR', message);
  }
}

export class ProviderError extends AppError {
  constructor(message = 'Provider error') {
    super(502, 'PROVIDER_ERROR', message);
  }
}

export class ProductOutOfStockError extends AppError {
  constructor(message = 'Product is out of stock') {
    super(409, 'PRODUCT_OUT_OF_STOCK', message);
  }
}

export class CartEmptyError extends AppError {
  constructor(message = 'Cart is empty') {
    super(400, 'CART_EMPTY', message);
  }
}

export class OrderAlreadyPaidError extends AppError {
  constructor(message = 'Order is already paid') {
    super(409, 'ORDER_ALREADY_PAID', message);
  }
}

export class PriceChangedError extends AppError {
  details?: unknown;
  constructor(message = 'The price has changed. Please review the updated order total.', details?: unknown) {
    super(409, 'PRICE_CHANGED', message);
    this.details = details;
  }
}

export class InvalidWebhookSignatureError extends AppError {
  constructor(message = 'Invalid webhook signature') {
    super(401, 'INVALID_WEBHOOK_SIGNATURE', message);
  }
}
