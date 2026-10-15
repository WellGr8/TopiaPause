import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;

async function openLanding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('topiapause:theme', 'dark');
    localStorage.setItem('topiapause:v3', JSON.stringify({ onboarded: false, lang: 'th', theme: 'dark' }));
  });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'ลองให้ AI จ่ายดู' })).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test.describe(`landing ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, colorScheme: 'dark' });

    test('scrolls and stays light when the system theme is dark', async ({ page }) => {
      await openLanding(page);
      await expect(page.locator('html')).not.toHaveClass(/dark/);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(247, 250, 255)');

      const taller = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 8);
      expect(taller).toBe(true);
      const rootOverflow = await page.evaluate(() => getComputedStyle(document.getElementById('root')!).overflowY);
      expect(rootOverflow).not.toBe('hidden');

      await page.mouse.wheel(0, 600);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    });
  });
}
