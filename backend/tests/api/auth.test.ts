import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();
const stamp = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
const email = `phase2test.${stamp}@example.com`;
const password = 'secure-password-1';
let token = '';

async function cleanup(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { startsWith: 'phase2test.' } } });
}

beforeAll(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Phase 2 — POST /api/v1/auth/register', () => {
  it('registers a user, returns safe user + token + httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Phase2 User', email, password });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.id).toBeDefined();
    expect(res.body.token).toBeDefined();
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('secure-password-1');
    token = res.body.token;

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie?.join(';')).toMatch(/rp_token=.*HttpOnly/i);
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email, password });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects invalid email with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Bad', email: 'not-an-email', password });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects short password with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Bad', email: `phase2test.short.${stamp}@example.com`, password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('Phase 2 — POST /api/v1/auth/login', () => {
  it('logs in with valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password-xyz' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('rejects unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `phase2test.unknown.${stamp}@example.com`, password });
    expect(res.status).toBe(401);
  });
});

describe('Phase 2 — GET /api/v1/auth/me + logout', () => {
  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid');
    expect(res.status).toBe(401);
  });

  it('returns the current user via Bearer token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('returns the current user via httpOnly cookie', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('logout clears the cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    const cleared = (res.headers['set-cookie'] as unknown as string[])?.join(';') ?? '';
    expect(cleared).toMatch(/rp_token=/);
  });
});

describe('Phase 2 — suspended users', () => {
  it('blocked login (403) and blocked /me (403) after suspension', async () => {
    await prisma.user.update({ where: { email }, data: { status: 'SUSPENDED' } });

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(login.status).toBe(403);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(403);

    await prisma.user.update({ where: { email }, data: { status: 'ACTIVE' } });
  });
});
