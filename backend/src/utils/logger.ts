type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogFields {
  request_id?: string;
  user_id?: string;
  session_id?: string;
  tool_name?: string;
  tool_status?: string;
  order_id?: string;
  payment_id?: string;
  provider?: string;
  status?: string | number;
  route?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'api_key',
  'apiKey',
  'secret',
  'token',
  'card',
  'cvv',
  'upi',
  'authorization',
]);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
}

function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(fields as Record<string, unknown>),
  };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => log('info', message, fields),
  warn: (message: string, fields?: LogFields) => log('warn', message, fields),
  error: (message: string, fields?: LogFields) => log('error', message, fields),
  debug: (message: string, fields?: LogFields) => {
    if (process.env.NODE_ENV !== 'production') log('debug', message, fields);
  },
};
