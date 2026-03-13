/**
 * Integration tests: GET /api/health
 */
import { describe, it, expect } from 'vitest';

vi.mock('@/db', () => ({ db: testDb }));

import { testDb } from '../setup';
import { vi } from 'vitest';

const { GET } = await import('@/app/api/health/route');

describe('GET /api/health', () => {
  it('DBが正常ならステータス ok を返す', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
  });
});
