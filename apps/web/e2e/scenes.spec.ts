import { expect, test } from '@playwright/test';

const SCENES = [
  { chip: 'ลองแอป PixelPro', offer: '฿299' },
  { chip: 'โรงแรมถูกๆ ใกล้อโศก', offer: '฿1,445' },
  { chip: 'แลก 500 USDT ครั้งเดียว', offer: '200 USDT' },
] as const;

test('three demo scenes pause and accept the counter-offer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    // Vite has no Worker, so the app's /api/health probe 404s and the in-browser engine runs.
    const text = msg.text();
    if (text.includes('/api/health')) return;
    errors.push(text);
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'ลองให้ AI จ่ายดู' }).click();

  for (const scene of SCENES) {
    await page.getByRole('button', { name: scene.chip }).click();
    const card = page.locator('[data-guard="verdict"]').last();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-decision', 'pause');
    await expect(card).toContainText(scene.offer);
    await card.getByRole('button', { name: 'ใช้ทางเลือกนี้' }).click();
    await expect(page.locator('[data-guard="done"]').last()).toBeVisible();
  }

  expect(errors).toEqual([]);
});
