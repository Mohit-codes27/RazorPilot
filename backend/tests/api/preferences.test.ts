import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `pref.${stamp}@example.com`;
const password = 'secure-password-1';

let token = '';

beforeAll(async () => {
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'PrefTest', email, password });
  expect(reg.status).toBe(201);
  token = reg.body.token as string;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.agentToolCall.deleteMany({ where: { session: { userId: { in: ids } } } });
    await prisma.agentMessage.deleteMany({ where: { session: { userId: { in: ids } } } });
    await prisma.agentSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userPreference.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
});

const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

describe('User preferences API', () => {
  it('returns empty preferences, updates, and reads back', async () => {
    const initial = await auth(request(app).get('/api/v1/users/me/preferences'));
    expect(initial.status).toBe(200);
    expect(initial.body.preferences.maxBudget).toBeNull();

    const patched = await auth(
      request(app).patch('/api/v1/users/me/preferences').send({
        maxBudget: 5000,
        preferredCurrency: 'INR',
        preferences: { wireless: true, priorities: ['comfort'] },
      }),
    );
    expect(patched.status).toBe(200);
    expect(patched.body.preferences).toMatchObject({ maxBudget: 5000, preferredCurrency: 'INR' });

    const reread = await auth(request(app).get('/api/v1/users/me/preferences'));
    expect(reread.body.preferences.preferences).toMatchObject({ wireless: true });
  });

  it('rejects empty updates and unauthenticated access', async () => {
    expect((await auth(request(app).patch('/api/v1/users/me/preferences').send({}))).status).toBe(400);
    expect((await request(app).get('/api/v1/users/me/preferences')).status).toBe(401);
  });
});

describe('Session list previews and product ratings', () => {
  it('lists sessions with first-message preview', async () => {
    const session = await auth(request(app).post('/api/v1/agent/sessions').send({}));
    const longMessage = 'I need wireless headphones under five thousand rupees for studying';
    await auth(
      request(app).post(`/api/v1/agent/sessions/${session.body.session.id}/messages`).send({ message: longMessage }),
    );
    const list = await auth(request(app).get('/api/v1/agent/sessions'));
    const found = list.body.data.find((s: { id: string }) => s.id === session.body.session.id);
    expect(found.preview).toBe(longMessage.slice(0, 60));
  });

  it('exposes ratings on product cards', async () => {
    const res = await request(app).get('/api/v1/products').query({ pageSize: 1 });
    const card = res.body.data[0];
    expect(typeof card.rating).toBe('number');
    expect(card.rating).toBeGreaterThanOrEqual(4);
    expect(card.rating).toBeLessThanOrEqual(5);
    expect(typeof card.reviewCount).toBe('number');
  });
});
