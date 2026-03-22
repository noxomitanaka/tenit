import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clubSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(_req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const [settings] = await db.select().from(clubSettings);
  if (!settings) return NextResponse.json({ error: 'Not configured' }, { status: 404 });

  // 秘密情報は書き込み専用のため返さない
  const { lineChannelSecret: _s, stripeSecretKey: _sk, stripeWebhookSecret: _sw, ...safe } = settings;
  return NextResponse.json(safe);
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const [existing] = await db.select().from(clubSettings);
  if (!existing) return NextResponse.json({ error: 'Not configured' }, { status: 404 });

  const updateData: Partial<typeof clubSettings.$inferInsert> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.substitutionDeadlineDays !== undefined) {
    updateData.substitutionDeadlineDays = Number(body.substitutionDeadlineDays);
  }
  if (body.cancellationDeadlineHours !== undefined) {
    updateData.cancellationDeadlineHours = Number(body.cancellationDeadlineHours);
  }
  if (body.defaultMonthlyFee !== undefined) {
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
  if (body.stripeSecretKey !== undefined) {
    updateData.stripeSecretKey = body.stripeSecretKey || null;
  }
  if (body.stripeWebhookSecret !== undefined) {
    updateData.stripeWebhookSecret = body.stripeWebhookSecret || null;
  }

  const [updated] = await db.update(clubSettings)
    .set(updateData)
    .where(eq(clubSettings.id, existing.id))
    .returning();

  const { lineChannelSecret: _s2, stripeSecretKey: _sk2, stripeWebhookSecret: _sw2, ...safe } = updated;
  return NextResponse.json(safe);
}
