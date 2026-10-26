import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('V3 real storefront and merchant workspace are usable at phone and desktop widths', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mkdir('artifacts/v3', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop/maison-sable');
  await expect(page.getByRole('heading', { name: 'Maison Sable — Démo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Espace professionnel' })).toHaveCount(0);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'artifacts/v3/customer-390.png', fullPage: true });
  await page.getByRole('button', { name: 'Demander · Foulard Lumière' }).click();
  await expect(page.getByRole('heading', { name: 'Foulard Lumière' }).last()).toBeVisible();
  await page.screenshot({ path: 'artifacts/v3/customer-inquiry-390.png', fullPage: true });
  await page.getByRole('button', { name: 'Choisir un autre article' }).click();
  await expect(page.getByRole('button', { name: 'Envoyer ma demande' })).toHaveCount(0);

  await page.goto('/shop/atelier-atlas?source=google');
  await page.getByRole('link', { name: 'Réserver ce soin' }).first().click();
  const selectedService = new URL(page.url()).searchParams.get('service');
  await expect(page.locator('#service')).toHaveValue(selectedService);
  await expect(page).toHaveURL(/source=google/);
  await page.screenshot({ path: 'artifacts/v3/customer-booking-390.png', fullPage: true });

  await page.goto('/login');
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('atlas@example.invalid');
  await page.getByRole('button', { name: 'Recevoir mon lien' }).click();
  await page.getByRole('link', { name: 'Ouvrir la boîte démo' }).click();
  await page
    .locator('article')
    .filter({ has: page.locator('strong', { hasText: 'atlas@example.invalid' }) })
    .first()
    .getByRole('link', { name: 'Se connecter avec ce lien' })
    .click();
  await page.getByRole('button', { name: 'Confirmer la connexion' }).click();
  await expect(page.getByRole('heading', { name: 'Votre salon, en un regard.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ce qui demande votre attention' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  expect(await page.locator('.tabs').evaluate((nav) => nav.scrollWidth <= nav.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/v3/merchant-390.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ce qui demande votre attention' })).toBeVisible();
  expect(await page.locator('.tabs').evaluate((nav) => nav.scrollWidth <= nav.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/v3/merchant-desktop.png', fullPage: true });
  await page.goto('/shop/atelier-atlas');
  await expect(page.getByRole('heading', { name: 'Atelier Atlas — Démo' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1440);
  await page.screenshot({ path: 'artifacts/v3/customer-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('V3 guided scenes fit desktop without horizontal overflow', async ({ page }) => {
  await mkdir('artifacts/v3', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/demo/merchant');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1440);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/v3/demo-merchant-desktop.png', fullPage: true });
  await page.goto('/demo/customer');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1440);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/v3/demo-customer-desktop.png', fullPage: true });
});
