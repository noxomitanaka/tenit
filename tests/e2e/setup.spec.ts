/**
 * E2E: セットアップフロー
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@libsql/client';
import path from 'path';

// 他スペック（auth.spec.ts）がDBを汚染している場合に備えてリセット
test.beforeAll(async () => {
  const dbPath = path.resolve(process.cwd(), 'test.db');
  const client = createClient({ url: `file:${dbPath}` });
  // FK依存順に全テーブルを削除
  await client.execute('DELETE FROM substitution_credit');
  await client.execute('DELETE FROM reservation');
  await client.execute('DELETE FROM lesson_slot');
  await client.execute('DELETE FROM lesson');
  await client.execute('DELETE FROM court');
  await client.execute('DELETE FROM member_group');
  await client.execute('DELETE FROM member');
  await client.execute('DELETE FROM "group"');
  await client.execute('DELETE FROM club_settings');
  await client.execute('DELETE FROM account');
  await client.execute('DELETE FROM session');
  await client.execute('DELETE FROM verificationToken');
  await client.execute('DELETE FROM user');
  client.close();
});

test.describe('セットアップページ', () => {
  test('/ にアクセスするとランディングページが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Tenit');
    await expect(page.getByRole('link', { name: 'ログイン' })).toBeVisible();
    await expect(page.getByRole('link', { name: '初回セットアップ' })).toBeVisible();
  });

  test('/setup にアクセスするとセットアップフォームが表示される', async ({ page }) => {
    await page.goto('/setup');
    await expect(page.locator('h1')).toContainText('Tenit');
    // placeholderで要素を特定（ラベルより安定）
    await expect(page.locator('input[placeholder*="テニスクラブ"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="田中"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('セットアップフォームを入力して送信すると完了画面に遷移する', async ({ page }) => {
    await page.goto('/setup');

    await page.fill('input[placeholder*="テニスクラブ"]', 'E2Eテストクラブ');
    await page.fill('input[placeholder*="田中"]', 'テスト管理者');
    await page.fill('input[type="email"]', 'admin@e2e-test.com');

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('testpass123');
    await passwordInputs.nth(1).fill('testpass123');

    await page.click('button[type="submit"]');

    // 完了画面の表示を確認
    await expect(page.getByText('セットアップ完了')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'ログインページへ' })).toBeVisible();
  });
});
