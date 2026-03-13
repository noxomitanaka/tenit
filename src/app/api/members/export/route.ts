/**
 * GET /api/members/export — 会員一覧を CSV でダウンロード
 * ?status=active|inactive  （省略時: 全件）
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api-auth';

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  // カンマ・ダブルクォート・改行を含む場合はダブルクォートで囲む
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const query = db.select().from(members);
  const rows = status
    ? await query.where(eq(members.status, status as 'active' | 'inactive'))
    : await query;

  const header = [
    'id', 'name', 'nameKana', 'email', 'phone', 'level', 'status',
    'joinedAt', 'leftAt', 'lineUserId', 'monthlyFee', 'notes', 'createdAt',
  ];

  const lines = [
    header.join(','),
    ...rows.map((m) => [
      escapeCsv(m.id),
      escapeCsv(m.name),
      escapeCsv(m.nameKana),
      escapeCsv(m.email),
      escapeCsv(m.phone),
      escapeCsv(m.level),
      escapeCsv(m.status),
      escapeCsv(m.joinedAt ? new Date(m.joinedAt).toISOString() : null),
      escapeCsv(m.leftAt ? new Date(m.leftAt).toISOString() : null),
      escapeCsv(m.lineUserId),
      escapeCsv(m.monthlyFee != null ? String(m.monthlyFee) : null),
      escapeCsv(m.notes),
      escapeCsv(m.createdAt ? new Date(m.createdAt).toISOString() : null),
    ].join(',')),
  ];

  const csv = lines.join('\n');
  const filename = `members_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
