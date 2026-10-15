import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('a per-payment limit pauses ฿600 and a higher limit follows the hotel rule', async ({ page }) => {
  mkdirSync('/tmp/user-rules', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/rules');
  await page.getByRole('switch', { name: 'จ่ายได้ไม่เกินต่อครั้ง' }).click();
  const amount = page.getByRole('spinbutton', { name: 'บาทต่อครั้ง' });
  await amount.fill('500');
  await expect(amount).toHaveValue('500');
  await page.getByRole('switch', { name: 'จ่ายได้ไม่เกินต่อครั้ง' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/user-rules/rules-390.png' });

  await page.getByRole('link', { name: 'แชท' }).click();
  await page.getByRole('button', { name: 'โรงแรมถูกๆ ใกล้อโศก' }).click();
  const paused = page.locator('[data-decision]').last();
  await expect(paused).toHaveAttribute('data-decision', 'pause');
  await expect(paused).toContainText('ติดกฎที่คุณตั้งไว้: จ่ายได้ไม่เกิน ฿500.00 ต่อครั้ง');
  await paused.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/user-rules/pause-390.png' });

  await page.getByRole('link', { name: 'กฎ' }).click();
  await page.getByRole('spinbutton', { name: 'บาทต่อครั้ง' }).fill('2000');
  await page.getByRole('link', { name: 'แชท' }).click();
  await page.getByRole('button', { name: 'โรงแรมถูกๆ ใกล้อโศก' }).click();
  const next = page.locator('[data-decision]').last();
  await expect(next).toHaveAttribute('data-decision', 'pause');
  await expect(next).not.toContainText('จ่ายได้ไม่เกิน');
  await expect(next).toContainText('คืนเงินไม่ได้');
});
