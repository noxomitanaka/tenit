/**
 * E2Eテスト共通ヘルパー
 */
import { Page } from '@playwright/test';

export const TEST_ADMIN = {
  clubName: 'E2Eテストクラブ',
  name: 'テスト管理者',
  email: 'admin@e2e-test.com',
  password: 'testpass123',
};

/** セットアップAPIを直接叩いて管理者を作成（UIテストの前提条件） */
export async function seedAdmin(baseURL: string) {
  const res = await fetch(`${baseURL}/api/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clubName: TEST_ADMIN.clubName,
      adminEmail: TEST_ADMIN.email,
      adminPassword: TEST_ADMIN.password,
      adminName: TEST_ADMIN.name,
    }),
  });
  if (!res.ok) {
    const body = await res.json();
    // 既にセットアップ済みの場合はOK（並列テスト時の冪等性）
    if (!body.error?.includes('既に完了')) {
      throw new Error(`seed failed: ${JSON.stringify(body)}`);
    }
  }
}

/** ログインして /dashboard に到達する */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}
