import { expect, test, type Page } from '@playwright/test';

const FITS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

async function openLanding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('topiapause:theme', 'dark');
    localStorage.setItem('topiapause:v3', JSON.stringify({ onboarded: false, lang: 'th', theme: 'dark' }));
  });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'ลองให้ AI จ่ายดู' })).toBeVisible();
}

for (const viewport of FITS) {
  test.describe(`landing ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, colorScheme: 'dark' });

    test('fits one screen and stays light when the system theme is dark', async ({ page }) => {
      await openLanding(page);
      await expect(page.locator('html')).not.toHaveClass(/dark/);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(247, 250, 255)');
      await expect(page.getByText('เดี๋ยวครับ คุณแค่อยากลอง')).toBeVisible();

      const fit = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        rootOverflow: getComputedStyle(document.getElementById('root')!).overflowY,
      }));
      expect(fit.scrollHeight).toBeLessThanOrEqual(fit.innerHeight);
      expect(fit.rootOverflow).not.toBe('hidden');
    });
  });
}

test('still scrolls when the phone is shorter than the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 560 });
  await openLanding(page);
  const rootOverflow = await page.evaluate(() => getComputedStyle(document.getElementById('root')!).overflowY);
  expect(rootOverflow).not.toBe('hidden');
  const taller = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 8);
  expect(taller).toBe(true);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
