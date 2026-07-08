/**
 * Integration tests: POST /api/fees/[id]/checkout（Stripe Checkout セッション作成）
 * 監査 #26（決済起点 API に統合テストが1本もない）への対応。
 * IDOR・二重決済防止・金額・旧セッション失効・sessionId 永続化を検証する。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { clubSettings, members, monthlyFees, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

vi.mock('@/db', () => ({ db: testDb, asRows: (r: unknown) => r as any[] }));
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', name: '田中', role: 'member' as const } }),
}));

const mockSessionCreate = vi.fn();
const mockSessionExpire = vi.fn();
const mockCustomerCreate = vi.fn();
vi.mock('stripe', () => ({
  default: class StripeMock {
    customers = { create: mockCustomerCreate };
    checkout = { sessions: { create: mockSessionCreate, expire: mockSessionExpire } };
  },
}));

const { POST } = await import('@/app/api/fees/[id]/checkout/route');

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}
function makeReq() {
  return new Request('http://localhost/api/fees/x/checkout', { method: 'POST' });
}

async function seed() {
  await testDb.insert(users).values({
    id: 'user-1', email: 'm@t.com', name: '田中', role: 'member', hashedPassword: 'x',
  });
  await testDb.insert(members).values({ id: 'm1', userId: 'user-1', name: '田中', status: 'active' });
  await testDb.insert(clubSettings).values({ id: 1, name: 'club', stripeSecretKey: 'sk_test_x' });
  await testDb.insert(monthlyFees).values({
    id: 'fee-1', memberId: 'm1', month: '2026-04', amount: 10000, status: 'pending',
  });
}

beforeEach(async () => {
  await resetDb();
  mockSessionCreate.mockReset();
  mockSessionExpire.mockReset();
  mockCustomerCreate.mockReset();
  mockCustomerCreate.mockResolvedValue({ id: 'cus_1' });
  mockSessionCreate.mockResolvedValue({ id: 'cs_new', url: 'https://stripe.test/cs_new' });
});

describe('POST /api/fees/[id]/checkout', () => {
  it('自分の未払い月謝で Checkout セッションを作成し、月謝額で決済する', async () => {
    await seed();
    const res = await POST(makeReq(), params('fee-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sessionId).toBe('cs_new');
    // 月謝額（10000円）で作成されること
    const arg = mockSessionCreate.mock.calls[0][0];
    expect(arg.line_items[0].price_data.unit_amount).toBe(10000);
    expect(arg.line_items[0].price_data.currency).toBe('jpy');
    expect(arg.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    // sessionId が永続化されること
    const [fee] = await testDb.select().from(monthlyFees).where(eq(monthlyFees.id, 'fee-1'));
    expect(fee.stripeCheckoutSessionId).toBe('cs_new');
  });

  it('他会員の月謝は404（IDOR 防止）', async () => {
    await seed();
    await testDb.insert(members).values({ id: 'm2', name: '他人', status: 'active' });
    await testDb.insert(monthlyFees).values({
      id: 'fee-2', memberId: 'm2', month: '2026-04', amount: 10000, status: 'pending',
    });
    const res = await POST(makeReq(), params('fee-2'));
    expect(res.status).toBe(404);
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('既に支払い済みの月謝は409', async () => {
    await seed();
    await testDb.update(monthlyFees).set({ status: 'paid' }).where(eq(monthlyFees.id, 'fee-1'));
    const res = await POST(makeReq(), params('fee-1'));
    expect(res.status).toBe(409);
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('免除（waived）の月謝は決済不可で409', async () => {
    await seed();
    await testDb.update(monthlyFees).set({ status: 'waived' }).where(eq(monthlyFees.id, 'fee-1'));
    const res = await POST(makeReq(), params('fee-1'));
    expect(res.status).toBe(409);
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('既存の未完了セッションがあれば失効させてから新規発行する（二重請求防止）', async () => {
    await seed();
    await testDb.update(monthlyFees)
      .set({ stripeCheckoutSessionId: 'cs_old' })
      .where(eq(monthlyFees.id, 'fee-1'));
    const res = await POST(makeReq(), params('fee-1'));
    expect(res.status).toBe(200);
    expect(mockSessionExpire).toHaveBeenCalledWith('cs_old');
  });
});
