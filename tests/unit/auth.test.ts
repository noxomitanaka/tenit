/**
 * Unit tests: パスワードユーティリティ（bcrypt 対応版）
 */
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isLegacyHash } from '@/lib/password';

describe('hashPassword', () => {
  it('文字列を bcrypt ハッシュに変換する', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toBeTypeOf('string');
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('同じ入力でも毎回異なるハッシュを返す（bcrypt ソルト）', async () => {
    const h1 = await hashPassword('password123');
    const h2 = await hashPassword('password123');
    expect(h1).not.toBe(h2); // salt が異なるため
  });

  it('空文字もハッシュ化できる', async () => {
    const hash = await hashPassword('');
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('日本語もハッシュ化できる', async () => {
    const hash = await hashPassword('テニスクラブ123');
    expect(hash.startsWith('$2b$')).toBe(true);
  });
});

describe('verifyPassword', () => {
  it('正しいパスワードで true を返す', async () => {
    const hash = await hashPassword('correctpassword');
    expect(await verifyPassword('correctpassword', hash)).toBe(true);
  });

  it('間違ったパスワードで false を返す', async () => {
    const hash = await hashPassword('correctpassword');
    expect(await verifyPassword('wrongpassword', hash)).toBe(false);
  });

  it('大文字小文字の差を区別する', async () => {
    const hash = await hashPassword('Password');
    expect(await verifyPassword('password', hash)).toBe(false);
  });

  it('旧 SHA-256 ハッシュでも検証できる（移行互換）', async () => {
    // SHA-256('test') = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    const sha256Hash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    expect(await verifyPassword('test', sha256Hash)).toBe(true);
    expect(await verifyPassword('wrong', sha256Hash)).toBe(false);
  });
});

describe('isLegacyHash', () => {
  it('bcrypt ハッシュは false', async () => {
    const hash = await hashPassword('test');
    expect(isLegacyHash(hash)).toBe(false);
  });

  it('SHA-256 ハッシュ（64文字 hex）は true', () => {
    const sha256Hash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
    expect(isLegacyHash(sha256Hash)).toBe(true);
  });
});
