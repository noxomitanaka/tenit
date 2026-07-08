import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(__dirname, 'screenshots');
mkdirSync(OUT, { recursive: true });

const ADMIN = { email: 'admin@example.com', password: 'admin1234' };
const BASE = 'http://localhost:3000';

async function getSessionCookies() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const setCookie = csrfRes.headers.get('set-cookie') ?? '';
  const csrfCookieMatch = setCookie.match(/authjs\.csrf-token=([^;]+)/);
  const csrfCookie = csrfCookieMatch ? csrfCookieMatch[1] : '';
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    email: ADMIN.email,
    password: ADMIN.password,
    csrfToken,
    callbackUrl: `${BASE}/dashboard`,
    json: 'true',
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `authjs.csrf-token=${csrfCookie}`,
    },
    body: body.toString(),
    redirect: 'manual',
  });

  const cookies: { name: string; value: string; url: string }[] = [];
  const rawCookies = loginRes.headers.getSetCookie?.() ?? [];
  for (const c of rawCookies) {
    const m = c.match(/^([^=]+)=([^;]*)/);
    if (!m) continue;
    cookies.push({ name: m[1], value: m[2], url: BASE });
  }
  return cookies;
}

test.use({ viewport: { width: 1440, height: 900 } });

async function snap(page, path: string, url: string, waitForText?: string) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  if (waitForText) {
    await page.locator(`text=${waitForText}`).first().waitFor({ timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, path), fullPage: true });
}

test('01-dashboard', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await getSessionCookies());
  const page = await ctx.newPage();
  await snap(page, '01-dashboard.png', '/dashboard');
  await ctx.close();
});

test('02-reservations-calendar', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await getSessionCookies());
  const page = await ctx.newPage();
  await snap(page, '02-reservations-calendar.png', '/dashboard/reservations');
  await ctx.close();
});

test('03-substitute-schedule', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await getSessionCookies());
  const page = await ctx.newPage();
  await snap(page, '03-substitute-schedule.png', '/dashboard/schedule');
  await ctx.close();
});

test('04-qr-attendance', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await getSessionCookies());
  const page = await ctx.newPage();
  await snap(page, '04-qr-attendance.png', '/dashboard/schedule/slot-004/attendance');
  await ctx.close();
});

test('05-mobile-portal', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies(await getSessionCookies());
  const page = await ctx.newPage();
  await snap(page, '05-mobile-portal.png', '/portal');
  await ctx.close();
});
