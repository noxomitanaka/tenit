/**
 * POST /api/fees/[id]/checkout — Stripe Checkout セッション作成
 * 会員が自分の月謝をオンライン決済するためのセッションURL を返す
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/db';
import { monthlyFees, members, clubSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireMember } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // 月謝レコード取得
  const [fee] = await db
    .select({
      id: monthlyFees.id,
      memberId: monthlyFees.memberId,
      month: monthlyFees.month,
      amount: monthlyFees.amount,
      status: monthlyFees.status,
      stripeCheckoutSessionId: monthlyFees.stripeCheckoutSessionId,
    })
    .from(monthlyFees)
    .where(eq(monthlyFees.id, id));

  if (!fee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // 自分の月謝のみ操作可能
  if (fee.memberId !== auth.member.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (fee.status === 'paid') {
    return NextResponse.json({ error: 'Already paid' }, { status: 409 });
  }

  // Stripe シークレットキー取得
  const [settings] = await db.select().from(clubSettings);
  if (!settings?.stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const stripe = new Stripe(settings.stripeSecretKey);

  // 既存の未完了 Checkout セッションを失効させる（二重請求経路の遮断）。
  // 失効に失敗しても新規発行は続行するが、旧セッションが有効なままだと
  // 旧URLと新URLの両方で決済され得るため必ず試みる。
  if (fee.stripeCheckoutSessionId) {
    try {
      await stripe.checkout.sessions.expire(fee.stripeCheckoutSessionId);
    } catch {
      // 既に完了・失効済みなら expire は失敗する。無視して新規発行に進む。
    }
  }

  // 会員情報取得
  const [member] = await db
    .select({ name: members.name, email: members.email, stripeCustomerId: members.stripeCustomerId })
    .from(members)
    .where(eq(members.id, fee.memberId));

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // Stripe 顧客 ID（なければ作成）
  let customerId = member.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: member.name,
      email: member.email ?? undefined,
      metadata: { memberId: fee.memberId },
    });
    customerId = customer.id;
    await db.update(members).set({ stripeCustomerId: customerId }).where(eq(members.id, fee.memberId));
  }

  // サーバー側でリダイレクトURLを決定（クライアント入力を無視し改ざんを防止）
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  // Checkout セッション作成
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `月謝 ${fee.month}`,
          },
          unit_amount: fee.amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    // 30分でセッション失効（Stripe が許す最小値）。放置された古いセッションが
    // 無期限に決済可能なまま残るのを防ぐ。
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${baseUrl}/portal/fees?success=true`,
    cancel_url: `${baseUrl}/portal/fees?canceled=true`,
    metadata: { feeId: fee.id, memberId: fee.memberId, month: fee.month },
  });

  // セッション ID を保存
  await db.update(monthlyFees)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(monthlyFees.id, fee.id));

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
