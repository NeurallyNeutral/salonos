import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
async function signin(page, address) {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(address);
  await page.getByRole('button', { name: 'Recevoir mon lien' }).click();
  await page.getByRole('link', { name: 'Ouvrir la boîte démo' }).click();
  const card = page
    .locator('article')
    .filter({ has: page.locator('strong', { hasText: address }) })
    .first();
  await card.getByRole('link', { name: 'Se connecter avec ce lien' }).click();
  await page.getByRole('button', { name: 'Confirmer la connexion' }).click();
}
test('V2-B mobile catalog inquiry survives another browser and remains separate from appointments', async ({
  page,
  browser,
}) => {
  await page.goto('/shop/maison-sable?source=instagram');
  await expect(page.getByRole('heading', { name: 'Maison Sable — Démo' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Demander · Sac Alba' }).click();
  await page.getByLabel('Votre nom', { exact: true }).fill('Demande mobile fictive');
  await page.getByLabel('Téléphone avec indicatif').fill('+212600000058');
  await page.getByLabel('J’autorise le commerce à me répondre pour cette demande.').check();
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByRole('heading', { name: 'Votre demande est enregistrée.' })).toBeVisible();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } }),
    owner = await ctx.newPage();
  await signin(owner, 'boutique@example.invalid');
  await expect(
    owner.getByRole('heading', { name: 'Sac Alba · Demande mobile fictive' }),
  ).toBeVisible();
  await owner.evaluate(() => localStorage.clear());
  await owner.reload();
  await expect(
    owner.getByRole('heading', { name: 'Sac Alba · Demande mobile fictive' }),
  ).toBeVisible();
  await owner.getByRole('button', { name: 'Enregistrer l’état' }).click();
  await expect(owner.getByText('État : contacted', { exact: false })).toBeVisible();
  expect(
    (await new AxeBuilder({ page: owner }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/v2-catalog-mobile.png', fullPage: true });
  await owner.screenshot({ path: 'artifacts/v2-catalog-owner.png', fullPage: true });
  await expect(owner.locator('body')).toHaveJSProperty('scrollWidth', 360);
  await ctx.close();
});
