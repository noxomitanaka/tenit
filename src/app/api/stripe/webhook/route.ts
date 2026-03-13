/**
 * POST /api/stripe/webhook — Stripe Webhook ハンドラ
 * payment_intent.succeeded → 月謝 status を paid に更新
 * checkout.session.completed → checkout 経由の支払いも処理
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { monthlyFees, clubSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
      await db.update(monthlyFees)
        .set({
          status: 'paid',
          paidAt: new Date(),
          stripePaymentIntentId: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : null,
        })
        .where(eq(monthlyFees.id, feeId));
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    // payment_intent ID で検索して対応する月謝を更新
    await db.update(monthlyFees)
      .set({ status: 'paid', paidAt: new Date(), stripePaymentIntentId: intent.id })
      .where(eq(monthlyFees.stripePaymentIntentId, intent.id));
  }

  return NextResponse.json({ received: true });
}
