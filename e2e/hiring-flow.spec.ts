import { expect, test } from '@playwright/test';

test('demo recruiter can open the living ATS', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /company admin/i }).click();
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible();
  await page.getByRole('link', { name: 'Jobs' }).click();
  await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();
  await page.getByRole('link', { name: 'Candidates' }).click();
  await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible();
});
