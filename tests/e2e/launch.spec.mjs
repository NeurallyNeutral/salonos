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
for (const mode of ['appointments', 'catalog_inquiry'])
  test(
    'V2-C first merchant publishes ' + mode + ' after resume, with no Meta connection',
    async ({ page }) => {
      const email = 'setup-' + mode + '@example.invalid',
        slug = 'setup-' + mode.replace('_', '-');
      await page.goto('/signup');
      await page.getByLabel('Adresse e-mail professionnelle').fill(email);
      await page.getByRole('button', { name: 'Créer mon commerce' }).click();
      await page.getByRole('link', { name: 'Ouvrir la boîte démo' }).click();
      await page
        .locator('article')
        .filter({ has: page.locator('strong', { hasText: email }) })
        .getByRole('link', { name: 'Vérifier mon adresse' })
        .click();
      await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
      await page.getByLabel('Nom du commerce', { exact: true }).fill('Premier commerce fictif');
      await page.getByLabel('Adresse de la vitrine').fill(slug);
      await page.getByLabel('Mode du commerce').selectOption(mode);
      await page.getByLabel('Téléphone professionnel WhatsApp').fill('+212600000000');
      await page.getByRole('button', { name: 'Enregistrer mon identité' }).click();
      await page.reload();
      await expect(page.getByLabel('Adresse de la vitrine')).toHaveValue(slug);
      await page
        .getByLabel(mode === 'appointments' ? 'Nom de la prestation' : 'Nom de l’article', {
          exact: true,
        })
        .fill('Offre de lancement');
      await page.getByRole('button', { name: 'Ajouter mon offre' }).click();
      await expect(
        page.getByText(mode === 'appointments' ? '1 prestation(s)' : 'Catalogue : 1 article(s)', {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByLabel('Je représente ce commerce et j’ai les droits sur son contenu.')
        .check();
      await page.getByLabel('J’ai vérifié les prix, horaires et conditions publiques.').check();
      await page.getByRole('button', { name: 'Publier ma vitrine' }).click();
      await expect(page.getByRole('heading', { name: 'Votre vitrine est publiée.' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Télécharger le QR' })).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await page.getByRole('link', { name: 'Voir ma vitrine', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Contacter sur WhatsApp' })).toHaveAttribute(
        'href',
        'https://wa.me/212600000000',
      );
      if (mode === 'appointments') {
        await page.getByRole('link', { name: 'Réserver un rendez-vous', exact: true }).click();
        await page.getByRole('button', { name: 'Voir les disponibilités' }).click();
        await expect(page.getByRole('radio').first()).toBeVisible();
      } else
        await expect(
          page.getByRole('button', { name: 'Demander · Offre de lancement' }),
        ).toBeVisible();
    },
  );
