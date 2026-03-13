/**
 * E2E: 認証フロー（ログイン・保護ルート）
 */
import { test, expect } from '@playwright/test';
import { seedAdmin, TEST_ADMIN, loginAs } from './helpers';

// 各テストの前に管理者ユーザーを用意
test.beforeAll(async ({ baseURL }) => {
  if (baseURL) await seedAdmin(baseURL);
});

test.describe('ログインページ', () => {
  test('/login にアクセスするとログインフォームが表示される', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Tenit');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
  });

  test('正しい認証情報でログインするとダッシュボードに遷移する', async ({ page }) => {
    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('ダッシュボード')).toBeVisible();
  });

  test('誤ったパスワードでログインするとエラーメッセージが表示される', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_ADMIN.email);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText('パスワードが正しくありません')).toBeVisible({ timeout: 5000 });
    // URLはログインページのまま
    await expect(page).toHaveURL(/\/login/);
  });

  test('存在しないメールアドレスでエラーが表示される', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'notexist@test.com');
    await page.fill('input[type="password"]', 'anypassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText('パスワードが正しくありません')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('保護ルート', () => {
  test('未認証で /dashboard にアクセスすると /login にリダイレクトされる', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('ログイン後は /dashboard にアクセスできる', async ({ page }) => {
    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('ダッシュボード')).toBeVisible();
  });
});
