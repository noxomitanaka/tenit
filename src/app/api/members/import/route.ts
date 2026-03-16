/**
 * POST /api/members/import — CSV 一括インポート
 * multipart/form-data で file フィールドに CSV を送る
 * ヘッダ行: name,nameKana,email,phone,level,status,monthlyFee,notes
 * id は自動生成。既存メールアドレスは SKIP（重複なし）
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '@/lib/id';
import { requireAdmin } from '@/lib/api-auth';

const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const VALID_STATUSES = ['active', 'inactive'] as const;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 });
  }

  const text = await (file as File).text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (lines.length < 2) {
    return NextResponse.json({ error: 'CSV must have header + at least 1 data row' }, { status: 400 });
  }

  const headerLine = lines[0].toLowerCase();
  const headers = parseCsvLine(headerLine);
  const nameIdx = headers.indexOf('name');
  if (nameIdx === -1) {
    return NextResponse.json({ error: 'CSV header must include "name" column' }, { status: 400 });
  }

  const col = (row: string[], colName: string): string | null => {
    const idx = headers.indexOf(colName);
    return idx >= 0 ? (row[idx]?.trim() || null) : null;
  };

  // 既存メールアドレスを取得
  const existing = await db.select({ email: members.email }).from(members);
  const existingEmails = new Set(existing.map((m) => m.email?.toLowerCase()).filter(Boolean));

  const inserted: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // バリデーション先行: エラーがあっても全件スキップせず、validな行のみ一括INSERT
  const toInsert: Array<typeof members.$inferInsert> = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const name = col(row, 'name');
    if (!name) {
      errors.push({ row: i + 1, message: 'name is empty' });
      continue;
    }

    const email = col(row, 'email');
    if (email && existingEmails.has(email.toLowerCase())) {
      skipped.push(name);
      continue;
    }

    const level = col(row, 'level');
    const status = col(row, 'status');
    const monthlyFeeStr = col(row, 'monthlyfee') ?? col(row, 'monthly_fee');

    if (level && !VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) {
      errors.push({ row: i + 1, message: `Invalid level: ${level}` });
      continue;
    }
    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      errors.push({ row: i + 1, message: `Invalid status: ${status}` });
      continue;
    }

    const monthlyFee = monthlyFeeStr ? Number(monthlyFeeStr) : null;
    if (monthlyFeeStr && isNaN(monthlyFee!)) {
      errors.push({ row: i + 1, message: `Invalid monthlyFee: ${monthlyFeeStr}` });
      continue;
    }

    toInsert.push({
      id: generateId(),
      name,
      nameKana: col(row, 'namekana') ?? col(row, 'name_kana'),
      email,
      phone: col(row, 'phone'),
      level: (level as typeof VALID_LEVELS[number]) ?? 'beginner',
      status: (status as typeof VALID_STATUSES[number]) ?? 'active',
      notes: col(row, 'notes'),
      monthlyFee: monthlyFee ?? null,
    });
    inserted.push(name);
    if (email) existingEmails.add(email.toLowerCase());
  }

  // バリデーション通過分を1トランザクションで一括 INSERT（途中失敗時に全件ロールバック）
  if (toInsert.length > 0) {
    await db.transaction(async (tx) => {
      for (const row of toInsert) {
        await tx.insert(members).values(row);
      }
    });
  }

  return NextResponse.json({
    inserted: inserted.length,
    skipped: skipped.length,
    errors,
  }, { status: 201 });
}
