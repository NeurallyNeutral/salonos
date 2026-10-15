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
  await page.waitForURL('**/launch');
  await expect(page.getByRole('heading', { name: 'Maison Sable — Démo' })).toBeVisible();
}
test('V2-G merchant payment/refund, connectors and safe preview stay truthful on a phone', async ({
  page,
}) => {
  // Create this test's inquiry independently of test ordering.
  const store = await (await page.request.get('/storefront/maison-sable')).json();
  const response = await page.request.post('/storefront/maison-sable/inquiries', {
    headers: {
      Origin: 'http://localhost:8790',
      'Idempotency-Key': crypto.randomUUID().replaceAll('-', ''),
    },
    data: {
      item_id: store.items.find((i) => i.id === 'item_sac').id,
      name: 'Paiement mobile fictif',
      phone: '+212600000068',
      consent_contact: true,
    },
  });
  expect(response.status()).toBe(201);
  await signin(page, 'boutique@example.invalid');
  await page.goto('/retention');
  await page.getByLabel('Crédit financé par le commerce').selectOption('200');
  await page
    .getByLabel(
      'Je comprends que mon commerce finance ce crédit et doit informer le client de ses conditions.',
    )
    .check();
  await page.getByLabel('Lien Google pour un avis honnête').fill('https://g.page/fiction/review');
  await page.getByRole('button', { name: 'Enregistrer la fidélité et les avis' }).click();
  await expect(page.locator('#notice')).toContainText('enregistrées');
  await page.goto('/launch');
  const inquiry = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: /Paiement mobile fictif/ }) })
    .first();
  await inquiry.getByLabel('État de la demande').selectOption('fulfilled');
  await inquiry.getByRole('button', { name: 'Enregistrer l’état' }).click();
  const payment = page
    .locator('#commerce-money article')
    .filter({ has: page.getByRole('heading', { name: /Paiement mobile fictif/ }) });
  await payment.getByLabel('Montant effectivement encaissé (MAD)').fill('180');
  await payment.getByLabel('Je confirme avoir réellement reçu ce paiement.').check();
  await payment.getByRole('button', { name: 'Enregistrer l’encaissement' }).click();
  await expect(payment.getByText(/crédit gagné/)).toBeVisible();
  await payment.getByLabel('Remboursement en espèces (MAD)').fill('90');
  await payment.getByLabel('Motif', { exact: true }).fill('Retour synthétique');
  await payment.getByRole('button', { name: 'Déclarer le remboursement' }).click();
  await expect(payment.getByText(/remboursé : 90/)).toBeVisible();
  await page.goto('/connections');
  const whatsapp = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'WhatsApp officiel' }) });
  await expect(whatsapp).toContainText('DISCONNECTED');
  await whatsapp.getByRole('button', { name: 'Tester la fixture whatsapp' }).click();
  await expect(whatsapp).toContainText('TESTING');
  await expect(whatsapp).toContainText('Aucune preuve de livraison réelle');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.goto('/setup');
  await page.getByLabel('Le commerce autorise ce contenu et cet aperçu.').check();
  await page.getByRole('button', { name: 'Créer un aperçu autorisé' }).click();
  await page.getByRole('link', { name: 'Ouvrir l’aperçu autorisé' }).click();
  await expect(page.getByText(/Aucune réservation, demande ou vente possible/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Demander/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Contacter sur WhatsApp' })).toHaveCount(0);
  await page.goto('/account');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
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
  await owner
    .locator('article')
    .filter({ has: owner.getByRole('heading', { name: 'Sac Alba · Demande mobile fictive' }) })
    .getByRole('button', { name: 'Enregistrer l’état' })
    .click();
  await expect(owner.getByText('État : Contact pris', { exact: false })).toBeVisible();
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
