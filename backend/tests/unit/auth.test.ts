import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../../src/modules/auth/auth.schemas.js';
import { signToken, verifyToken } from '../../src/security/jwt.js';
import { hashPassword, verifyPassword } from '../../src/security/password.js';

describe('Phase 2 — password hashing', () => {
  it('hashes and verifies a password, rejects wrong password', async () => {
    const hash = await hashPassword('correct-horse-123');
    expect(hash).not.toContain('correct-horse-123');
    expect(await verifyPassword('correct-horse-123', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});

describe('Phase 2 — JWT', () => {
  it('sign/verify roundtrips the user id as sub', () => {
    const token = signToken('user-123');
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('rejects tampered tokens', () => {
    const token = signToken('user-123') + 'tamper';
    expect(() => verifyToken(token)).toThrow();
  });
});

describe('Phase 2 — auth schemas', () => {
  it('accepts valid register input', () => {
    const parsed = registerSchema.parse({
      name: 'Demo User',
      email: 'Demo@Example.com',
      password: 'secure-password-1',
    });
    expect(parsed.email).toBe('demo@example.com');
  });

  it('rejects bad email and short password', () => {
    expect(() =>
      registerSchema.parse({ name: 'A', email: 'not-an-email', password: 'short' }),
    ).toThrow();
    expect(() => loginSchema.parse({ email: 'a@b.co', password: '' })).toThrow();
  });
});
