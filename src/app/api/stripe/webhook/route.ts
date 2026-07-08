/**
 * POST /api/stripe/webhook — Stripe Webhook ハンドラ
 * payment_intent.succeeded → 月謝 status を paid に更新
 * checkout.session.completed → checkout 経由の支払いも処理
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { monthlyFees, clubSettings } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // クラブ設定から Webhook シークレット取得
  const [settings] = await db.select().from(clubSettings);
  if (!settings?.stripeSecretKey || !settings?.stripeWebhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const stripe = new Stripe(settings.stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, settings.stripeWebhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const feeId = session.metadata?.feeId;
    if (feeId && session.payment_status === 'paid') {
      // 決済金額を月謝額と照合してから paid 化する。
      // 金額不一致（旧額セッション・改ざん）や二重処理を受理しない。
      const [fee] = await db.select().from(monthlyFees).where(eq(monthlyFees.id, feeId));
      if (!fee) {
        console.error(`[stripe-webhook] fee not found: ${feeId}`);
      } else if (fee.status === 'paid') {
        // 既に paid。重複 webhook として無視する。
      } else if (session.amount_total !== fee.amount || session.currency !== 'jpy') {
        console.error(
          `[stripe-webhook] amount mismatch for fee ${feeId}: paid ${session.amount_total} ${session.currency}, expected ${fee.amount} jpy`
        );
      } else {
        await db.update(monthlyFees)
          .set({
            status: 'paid',
            paidAt: new Date(),
            stripePaymentIntentId: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null,
          })
          .where(and(eq(monthlyFees.id, feeId), ne(monthlyFees.status, 'paid')));
      }
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    // payment_intent ID で対応する月謝を更新。既に paid の行は更新しない
    // （イベント再配信で paidAt が上書きされ支払日時の監査証跡が壊れるのを防ぐ）。
    await db.update(monthlyFees)
      .set({ status: 'paid', paidAt: new Date(), stripePaymentIntentId: intent.id })
      .where(and(eq(monthlyFees.stripePaymentIntentId, intent.id), ne(monthlyFees.status, 'paid')));
  }

  return NextResponse.json({ received: true });
}
