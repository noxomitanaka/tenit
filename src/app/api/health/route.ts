/**
 * GET /api/health — ヘルスチェック
 * Docker / load balancer / uptime monitor から呼ばれる
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clubSettings } from '@/db/schema';

export async function GET() {
  try {
    // DB 接続確認
    await db.select().from(clubSettings).limit(1);
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: 'error', timestamp: new Date().toISOString() }, { status: 503 });
  }
}
