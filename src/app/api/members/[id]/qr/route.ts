/**
 * GET /api/members/[id]/qr
 * 会員QRコードをPNG画像として返す
 * QRコードの内容: memberId（出席打刻スキャン用）
 */
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [member] = await db.select({ id: members.id, name: members.name })
    .from(members).where(eq(members.id, id));
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // QRコードの内容はmemberIdのみ（スキャン側でAPIを叩く）
  const buffer = await QRCode.toBuffer(member.id, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 300,
    margin: 2,
    color: { dark: '#064e3b', light: '#ffffff' }, // emerald-900
  });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': `inline; filename="qr-${member.id}.png"`,
    },
  });
}
