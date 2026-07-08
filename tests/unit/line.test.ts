/**
 * Unit tests: validateLineSignature（実 HMAC-SHA256 署名の検証）。
 * 監査 #62（署名検証がモック固定で実装が一度も走らない）への対応。
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { validateLineSignature } from '@/lib/line';

const SECRET = 'test-channel-secret';

function sign(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body).digest('base64');
}

describe('validateLineSignature', () => {
  it('正しい署名を受理する', () => {
    const body = JSON.stringify({ events: [] });
    expect(validateLineSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('改竄された本文の署名を拒否する', () => {
    const body = JSON.stringify({ events: [] });
    const sig = sign(body);
    const tampered = JSON.stringify({ events: [{ type: 'message' }] });
    expect(validateLineSignature(tampered, sig, SECRET)).toBe(false);
  });

  it('別のシークレットで作った署名を拒否する', () => {
    const body = JSON.stringify({ events: [] });
    expect(validateLineSignature(body, sign(body, 'other-secret'), SECRET)).toBe(false);
  });
});
