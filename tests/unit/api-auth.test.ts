/**
 * Unit tests: src/lib/api-auth のロールガード（認可マトリクス）。
 * 監査 #27（認可のネガティブテストがほぼ不在）への対応。
 * 各ガードが 未ログイン→401 / 権限不足→403 / 許可ロール→通過 を満たすことを検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = vi.fn();
vi.mock('@/auth', () => ({ auth: () => mockAuth() }));

import { requireAuth, requireAdmin, requireCoach, requireStaff } from '@/lib/api-auth';

function setSession(role?: string | null) {
  if (role === null || role === undefined) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: 'u1', name: 'x', role } });
  }
}

async function statusOf(result: Awaited<ReturnType<typeof requireAdmin>>): Promise<number | 'ok'> {
  return result.ok ? 'ok' : result.response.status;
}

beforeEach(() => { mockAuth.mockReset(); });

describe('requireAuth', () => {
  it('未ログインは401', async () => {
    setSession(null);
    expect(await statusOf(await requireAuth())).toBe(401);
  });
  it('ログイン済みは通過', async () => {
    setSession('member');
    expect(await statusOf(await requireAuth())).toBe('ok');
  });
});

describe('requireAdmin', () => {
  it.each([
    ['未ログイン', null, 401],
    ['member', 'member', 403],
    ['coach', 'coach', 403],
    ['staff', 'staff', 403],
    ['admin', 'admin', 'ok'],
  ])('%s → %s', async (_label, role, expected) => {
    setSession(role as string | null);
    expect(await statusOf(await requireAdmin())).toBe(expected);
  });
});

describe('requireCoach（admin/coach のみ）', () => {
  it.each([
    ['未ログイン', null, 401],
    ['member', 'member', 403],
    ['staff', 'staff', 403],
    ['coach', 'coach', 'ok'],
    ['admin', 'admin', 'ok'],
  ])('%s → %s', async (_label, role, expected) => {
    setSession(role as string | null);
    expect(await statusOf(await requireCoach())).toBe(expected);
  });
});

describe('requireStaff（admin/staff のみ）', () => {
  it.each([
    ['未ログイン', null, 401],
    ['member', 'member', 403],
    ['coach', 'coach', 403],
    ['staff', 'staff', 'ok'],
    ['admin', 'admin', 'ok'],
  ])('%s → %s', async (_label, role, expected) => {
    setSession(role as string | null);
    expect(await statusOf(await requireStaff())).toBe(expected);
  });
});
