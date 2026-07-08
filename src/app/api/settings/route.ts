import { NextResponse } from 'next/server';
import { db, asRows } from '@/db';
import { clubSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';
import { isNonNegativeInt } from '@/lib/validation';

// 書き込み専用の秘密情報。GET/PUT のレスポンスから必ず除外する。
// lineChannelAccessToken も push 送信・友だち情報取得が可能な bearer secret のため除外対象。
function stripSecrets(settings: typeof clubSettings.$inferSelect) {
  const {
    lineChannelSecret: _s,
    lineChannelAccessToken: _at,
    stripeSecretKey: _sk,
    stripeWebhookSecret: _sw,
    ...safe
  } = settings;
  return safe;
}

export async function GET(_req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const [settings] = await db.select().from(clubSettings);
  if (!settings) return NextResponse.json({ error: 'Not configured' }, { status: 404 });

  return NextResponse.json(stripSecrets(settings));
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const [existing] = await db.select().from(clubSettings);
  if (!existing) return NextResponse.json({ error: 'Not configured' }, { status: 404 });

  const updateData: Partial<typeof clubSettings.$inferInsert> = {};
  if (body.name !== undefined) updateData.name = body.name;
  // 数値設定は NaN・負値・小数の DB 混入を防ぐため非負整数を必須化する。
  if (body.substitutionDeadlineDays !== undefined) {
    if (!isNonNegativeInt(body.substitutionDeadlineDays, 3650)) {
      return NextResponse.json({ error: 'substitutionDeadlineDays must be a non-negative integer' }, { status: 400 });
    }
    updateData.substitutionDeadlineDays = Number(body.substitutionDeadlineDays);
  }
  if (body.cancellationDeadlineHours !== undefined) {
    if (!isNonNegativeInt(body.cancellationDeadlineHours, 8760)) {
      return NextResponse.json({ error: 'cancellationDeadlineHours must be a non-negative integer' }, { status: 400 });
    }
    updateData.cancellationDeadlineHours = Number(body.cancellationDeadlineHours);
  }
  if (body.defaultMonthlyFee !== undefined) {
    if (!isNonNegativeInt(body.defaultMonthlyFee)) {
      return NextResponse.json({ error: 'defaultMonthlyFee must be a non-negative integer' }, { status: 400 });
    }
    updateData.defaultMonthlyFee = Number(body.defaultMonthlyFee);
  }
  if (body.lineChannelAccessToken !== undefined) {
    updateData.lineChannelAccessToken = body.lineChannelAccessToken || null;
  }
  if (body.lineChannelSecret !== undefined) {
    updateData.lineChannelSecret = body.lineChannelSecret || null;
  }
  if (body.stripePublishableKey !== undefined) {
    updateData.stripePublishableKey = body.stripePublishableKey || null;
  }
  // Stripe 秘密鍵・Webhook シークレットは誤入力の無検証保存を防ぐため prefix を検証する。
  if (body.stripeSecretKey !== undefined) {
    if (body.stripeSecretKey && !String(body.stripeSecretKey).startsWith('sk_')) {
      return NextResponse.json({ error: 'stripeSecretKey must start with sk_' }, { status: 400 });
    }
    updateData.stripeSecretKey = body.stripeSecretKey || null;
  }
  if (body.stripeWebhookSecret !== undefined) {
    if (body.stripeWebhookSecret && !String(body.stripeWebhookSecret).startsWith('whsec_')) {
      return NextResponse.json({ error: 'stripeWebhookSecret must start with whsec_' }, { status: 400 });
    }
    updateData.stripeWebhookSecret = body.stripeWebhookSecret || null;
  }

  const [updated] = asRows(await db.update(clubSettings)
    .set(updateData)
    .where(eq(clubSettings.id, existing.id))
    .returning());

  return NextResponse.json(stripSecrets(updated));
}
