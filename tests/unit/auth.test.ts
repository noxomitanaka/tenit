/**
 * Unit tests: パスワードユーティリティ
 */
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('hashPassword', () => {
  it('文字列をSHA-256ハッシュに変換する（64文字hex）', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toBeTypeOf('string');
    expect(hash).toHaveLength(64);
  });

  it('同じ入力は常に同じハッシュを返す（決定論的）', async () => {
    const h1 = await hashPassword('password123');
    const h2 = await hashPassword('password123');
    expect(h1).toBe(h2);
  });

  it('異なる入力は異なるハッシュを返す', async () => {
    const h1 = await hashPassword('password123');
    const h2 = await hashPassword('Password123');
    expect(h1).not.toBe(h2);
  });

  it('空文字もハッシュ化できる', async () => {
    const hash = await hashPassword('');
    expect(hash).toHaveLength(64);
  });

  it('日本語もハッシュ化できる', async () => {
    const hash = await hashPassword('テニスクラブ123');
    expect(hash).toHaveLength(64);
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
});
