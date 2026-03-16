/**
 * Integration tests: POST /api/stripe/webhook
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../helpers/db';
import { testDb } from '../setup';
import { clubSettings, members, monthlyFees } from '@/db/schema';
import { eq } from 'drizzle-orm';

vi.mock('@/db', () => ({ db: testDb }));

// Stripe モジュールをモック — constructEvent を制御可能にする
const mockConstructEvent = vi.fn();
vi.mock('stripe', () => {
  return {
    default: class StripeMock {
      webhooks = { constructEvent: mockConstructEvent };
    },
  };
});

const { POST } = await import('@/app/api/stripe/webhook/route');

function makeWebhookReq(body: string, sig?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sig) headers['stripe-signature'] = sig;
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

async function seedSettings() {
  await testDb.insert(clubSettings).values({
    id: 1,
    name: 'テストクラブ',
    substitutionDeadlineDays: 31,
    stripeSecretKey: 'sk_test_xxx',
    stripeWebhookSecret: 'whsec_test_xxx',
  });
}

async function seedFee(overrides: Partial<typeof monthlyFees.$inferInsert> = {}) {
  await testDb.insert(members).values({ id: 'm1', name: '田中', status: 'active' });
  await testDb.insert(monthlyFees).values({
    id: 'fee-1',
    memberId: 'm1',
    month: '2026-04',
    amount: 10000,
    status: 'pending',
    ...overrides,
  });
}

beforeEach(async () => {
  await resetDb();
  mockConstructEvent.mockReset();
});

describe('POST /api/stripe/webhook', () => {
  it('stripe-signature ヘッダーがない場合は 400', async () => {
    const res = await POST(makeWebhookReq('{}'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('stripe-signature');
  });

  it('Stripe 未設定の場合は 503', async () => {
    // clubSettings にStripeキーなし
    await testDb.insert(clubSettings).values({
      id: 1,
      name: 'テストクラブ',
      substitutionDeadlineDays: 31,
    });
    const res = await POST(makeWebhookReq('{}', 'sig_test'));
    expect(res.status).toBe(503);
  });

  it('署名検証に失敗した場合は 400', async () => {
    await seedSettings();
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const res = await POST(makeWebhookReq('{}', 'sig_invalid'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid signature');
  });

  it('checkout.session.completed で月謝を paid に更新する', async () => {
    await seedSettings();
    await seedFee();
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { feeId: 'fee-1' },
          payment_status: 'paid',
          payment_intent: 'pi_test_123',
        },
      },
    });
    const res = await POST(makeWebhookReq('{}', 'sig_ok'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    // DB 確認
    const [fee] = await testDb.select().from(monthlyFees).where(eq(monthlyFees.id, 'fee-1'));
    expect(fee.status).toBe('paid');
    expect(fee.paidAt).not.toBeNull();
    expect(fee.stripePaymentIntentId).toBe('pi_test_123');
  });

  it('checkout.session.completed で payment_status が paid でなければ更新しない', async () => {
    await seedSettings();
    await seedFee();
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { feeId: 'fee-1' },
          payment_status: 'unpaid',
          payment_intent: 'pi_test_456',
        },
      },
    });
    const res = await POST(makeWebhookReq('{}', 'sig_ok'));
    expect(res.status).toBe(200);

    const [fee] = await testDb.select().from(monthlyFees).where(eq(monthlyFees.id, 'fee-1'));
    expect(fee.status).toBe('pending');
  });

  it('checkout.session.completed で feeId が metadata にない場合はスキップ', async () => {
    await seedSettings();
    await seedFee();
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {},
          payment_status: 'paid',
          payment_intent: 'pi_test_789',
        },
      },
    });
    const res = await POST(makeWebhookReq('{}', 'sig_ok'));
    expect(res.status).toBe(200);

    const [fee] = await testDb.select().from(monthlyFees).where(eq(monthlyFees.id, 'fee-1'));
    expect(fee.status).toBe('pending');
  });

  it('payment_intent.succeeded で対応する月謝を paid に更新する', async () => {
    await seedSettings();
    await seedFee({ stripePaymentIntentId: 'pi_match_001' });
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_match_001',
        },
      },
    });
    const res = await POST(makeWebhookReq('{}', 'sig_ok'));
    expect(res.status).toBe(200);

    const [fee] = await testDb.select().from(monthlyFees).where(eq(monthlyFees.id, 'fee-1'));
    expect(fee.status).toBe('paid');
    expect(fee.paidAt).not.toBeNull();
  });

  it('payment_intent.succeeded で該当する月謝がない場合もエラーにならない', async () => {
    await seedSettings();
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: { id: 'pi_orphan_999' },
      },
    });
    const res = await POST(makeWebhookReq('{}', 'sig_ok'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it('未対応イベントタイプでも 200 を返す', async () => {
    await seedSettings();
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.created',
      data: { object: {} },
    });
    const res = await POST(makeWebhookReq('{}', 'sig_ok'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });
});
