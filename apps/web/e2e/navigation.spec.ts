import { expect, test } from '@playwright/test';

test('back, the logo, and a refresh keep landing and the app apart', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'ลองให้ AI จ่ายดู' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /จองที่พัก/ })).toHaveAttribute('href', '/app?scene=stay');

  await page.getByRole('link', { name: 'ลองให้ AI จ่ายดู' }).click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByText('ผู้ช่วย AI (จำลอง)')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /ก่อน AI จ่าย/ })).toBeVisible();

  await page.getByRole('link', { name: 'ลองให้ AI จ่ายดู' }).click();
  await expect(page).toHaveURL(/\/app/);
  await page.getByRole('link', { name: 'กลับหน้าแรก' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'ลองให้ AI จ่ายดู' })).toBeVisible();

  await page.goto('/app');
  await expect(page.getByText('ผู้ช่วย AI (จำลอง)')).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('ผู้ช่วย AI (จำลอง)')).toBeVisible();

  await page.goto('/app?scene=stay');
  await expect(page.getByText('หาโรงแรมถูกๆ ใกล้อโศก คืนวันศุกร์ แต่แผนอาจเปลี่ยนนะ')).toBeVisible();

  await page.goto('/app/rules');
  await expect(page.getByRole('heading', { name: 'กฎของคุณ' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/app\/rules/);
  await expect(page.getByRole('heading', { name: 'กฎของคุณ' })).toBeVisible();

  await page.goto('/app?tab=activity');
  await expect(page.getByRole('heading', { name: 'กิจกรรม' })).toBeVisible();
});
