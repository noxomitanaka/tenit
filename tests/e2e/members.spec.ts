/**
 * E2E: 会員管理フロー
 */
import { test, expect } from '@playwright/test';
import { seedAdmin, loginAs, TEST_ADMIN } from './helpers';

test.beforeAll(async ({ baseURL }) => {
  if (baseURL) await seedAdmin(baseURL);
});

test.describe('会員管理', () => {
  test('/dashboard/members にアクセスできる', async ({ page }) => {
    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await page.goto('/dashboard/members');
    await expect(page).toHaveURL(/\/dashboard\/members/);
    await expect(page.locator('h2')).toContainText('会員管理');
  });

  test('サイドバーに会員管理リンクがある', async ({ page }) => {
    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await expect(page.getByRole('link', { name: '会員管理' })).toBeVisible();
  });

  test('会員追加フォームが表示される', async ({ page }) => {
    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await page.goto('/dashboard/members/new');
    await expect(page.locator('h2')).toContainText('会員を追加');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('会員を追加して一覧に表示される', async ({ page }) => {
    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await page.goto('/dashboard/members/new');

    await page.fill('input[name="name"]', 'E2Eテスト会員');
    await page.fill('input[name="email"]', 'e2e-member@test.com');
    await page.fill('input[name="phone"]', '090-9999-8888');
    await page.click('button[type="submit"]');

    // 一覧ページに遷移して会員が表示される
    await expect(page).toHaveURL(/\/dashboard\/members$/, { timeout: 10000 });
    await expect(page.getByText('E2Eテスト会員')).toBeVisible({ timeout: 5000 });
  });

  test('スケジュールページにアクセスできる', async ({ page }) => {
    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await page.goto('/dashboard/schedule');
    await expect(page.locator('h2')).toContainText('スケジュール');
    // react-big-calendarのカレンダーが表示される
    await expect(page.locator('.rbc-calendar')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('入会申請フォーム', () => {
  test('/join にアクセスすると入会申請フォームが表示される', async ({ page }) => {
    await page.goto('/join');
    await expect(page.locator('h1').filter({ hasText: '入会申請' })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('入会申請を送信すると完了メッセージが表示される', async ({ page }) => {
    await page.goto('/join');
    await page.fill('input[name="name"]', '申請テスト太郎');
    await page.fill('input[name="email"]', 'application-test@join.com');
    await page.click('button[type="submit"]');
    await expect(page.getByText('申請を受け付けました')).toBeVisible({ timeout: 10000 });
  });
});
