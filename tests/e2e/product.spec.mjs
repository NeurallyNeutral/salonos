import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const authenticatedCookies = new Map();

test('mobile booking and merchant screens pass automated accessibility checks and keyboard navigation', async ({
  page,
}) => {
  await page.goto('/book/studio-rivage');
  await page.getByRole('button', { name: 'Voir les disponibilités' }).click();
  const booking = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(booking.violations).toEqual([]);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await login(page);
  const dashboard = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(dashboard.violations).toEqual([]);
});

test('merchant creates a manual appointment and configures a closure in the mobile UI', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Ajouter un rendez-vous' }).click();
  await page.getByRole('button', { name: 'Voir les disponibilités' }).click();
  await page.getByRole('radio').nth(30).check();
  await page.getByLabel('Votre nom', { exact: true }).fill('Rendez-vous manuel fictif');
  await page.getByLabel('Téléphone avec indicatif').fill('+212600000078');
  await page.getByRole('button', { name: 'Ajouter le rendez-vous', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'C’est dans l’agenda.' })).toBeVisible();
  await page.getByRole('link', { name: 'Retour à l’agenda' }).click();
  await page.getByRole('button', { name: 'Horaires', exact: true }).click();
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Début de fermeture').fill(date + 'T09:00');
  await page.getByLabel('Fin de fermeture').fill(date + 'T11:00');
  await page.getByRole('button', { name: 'Enregistrer la fermeture' }).click();
  await expect(page.getByRole('button', { name: 'Retirer la fermeture' })).toBeVisible();
  await page.getByRole('button', { name: 'Retirer la fermeture' }).click();
  await expect(page.getByRole('button', { name: 'Retirer la fermeture' })).toHaveCount(0);
});
async function login(page, address = 'atlas@example.invalid') {
  if (authenticatedCookies.has(address)) {
    await page.context().addCookies(authenticatedCookies.get(address));
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Votre salon, en un regard.' })).toBeVisible();
    return;
  }
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(address);
  await page.getByRole('button', { name: 'Recevoir mon lien' }).click();
  await expect(page.locator('#login-result')).toContainText('votre lien');
  await page.getByRole('link', { name: 'Ouvrir la boîte démo' }).click();
  const card = page
    .locator('article')
    .filter({ has: page.locator('strong', { hasText: address }) })
    .first();
  await card.getByRole('link', { name: 'Se connecter avec ce lien' }).click();
  await page.getByRole('button', { name: 'Confirmer la connexion' }).click();
  await expect(page.getByRole('heading', { name: 'Votre salon, en un regard.' })).toBeVisible();
  authenticatedCookies.set(address, await page.context().cookies());
}
test('mobile booking persists across independent browsers, then self-reschedule and cancel', async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mkdir('artifacts', { recursive: true });
  await page.goto('/book/atelier-atlas');
  await page.getByRole('button', { name: 'Voir les disponibilités' }).click();
  await page.getByRole('radio').first().check();
  await page.getByLabel('Votre nom', { exact: true }).fill('Cliente Mobile Fictive');
  await page.getByLabel('Téléphone avec indicatif').fill('+212600000091');
  await page.getByLabel('E-mail (facultatif)').fill('mobile@example.invalid');
  await page.getByLabel('Recevoir les confirmations et rappels par e-mail.').check();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 360);
  await page.screenshot({ path: 'artifacts/mobile-booking.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirmer mon rendez-vous' }).click();
  await expect(page.getByRole('heading', { name: 'C’est dans l’agenda.' })).toBeVisible();
  const manage = await page
    .getByRole('link', { name: 'Gérer mon rendez-vous' })
    .getAttribute('href');
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } }),
    owner = await context.newPage();
  await login(owner);
  await owner.getByRole('button', { name: 'Agenda', exact: true }).click();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await owner.getByLabel('Date de l’agenda').fill(tomorrow);
  await expect(owner.getByText('Cliente Mobile Fictive', { exact: false })).toBeVisible();
  await owner.evaluate(() => localStorage.clear());
  await owner.reload();
  await owner.getByRole('button', { name: 'Agenda', exact: true }).click();
  await owner.getByLabel('Date de l’agenda').fill(tomorrow);
  await expect(owner.getByText('Cliente Mobile Fictive', { exact: false })).toBeVisible();
  await owner.screenshot({ path: 'artifacts/mobile-dashboard.png', fullPage: true });
  await page.goto(manage);
  await page.getByRole('button', { name: 'Choisir un autre créneau' }).click();
  await page.getByRole('button', { name: 'Voir les disponibilités' }).click();
  await page.getByRole('radio').last().check();
  await page.getByRole('button', { name: 'Confirmer le déplacement' }).click();
  await expect(page.getByRole('heading', { name: 'Votre rendez-vous', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Annuler le rendez-vous' }).click();
  await expect(page.getByRole('heading', { name: 'Votre créneau a été libéré.' })).toBeVisible();
  await expect(errors).toEqual([]);
  await context.close();
});
test('merchant pause, services, weekly calendar and second tenant isolation through UI', async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByLabel('Suspendre les nouvelles réservations en ligne').check();
  await page.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await expect(page.locator('#notice')).toContainText('enregistrées');
  const ctx = await browser.newContext(),
    publicPage = await ctx.newPage();
  await publicPage.goto('/book/atelier-atlas');
  await expect(
    publicPage.getByText('Les réservations en ligne sont momentanément suspendues.'),
  ).toBeVisible();
  await publicPage.goto('/book/studio-rivage');
  await publicPage.getByRole('button', { name: 'Voir les disponibilités' }).click();
  await expect(publicPage.getByRole('radio').first()).toBeVisible();
  await page.getByLabel('Suspendre les nouvelles réservations en ligne').uncheck();
  await page.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await page.getByRole('button', { name: 'Prestations & équipe' }).click();
  await page.getByText('Ajouter une prestation', { exact: true }).click();
  await page.getByLabel('Nom de la prestation').fill('Soin Mobile');
  await page.locator('#new-duration').fill('30');
  await page.getByRole('button', { name: 'Créer la prestation' }).click();
  await expect(page.getByRole('heading', { name: 'Soin Mobile', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await expect(page.getByLabel('Date de l’agenda')).toBeVisible();
  await ctx.close();
});
test('completed visit, actual payment, loyalty and partial refund through mobile dashboard', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByLabel('Taux de crédit').selectOption('100');
  await page.getByRole('button', { name: 'Enregistrer les réglages' }).click();
  await expect(page.locator('#notice')).toContainText('enregistrées');
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page
    .getByLabel('Date de l’agenda')
    .fill(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  await expect(page.getByText('Visite Démo atlas', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Marquer terminé' }).click();
  await page.getByRole('button', { name: 'Paiement & fidélité', exact: true }).click();
  await page.getByLabel('Je confirme que ce paiement a réellement été reçu.').check();
  await page.getByRole('button', { name: 'Enregistrer le paiement', exact: true }).click();
  await expect(page.getByText('1,20', { exact: false }).first()).toBeVisible();
  await page.getByText('Enregistrer un remboursement / une annulation', { exact: true }).click();
  await page.getByLabel('Paiement remboursé (MAD)').fill('60');
  await page.getByLabel('Motif', { exact: true }).fill('Remboursement partiel démo');
  await page.getByRole('button', { name: 'Confirmer le remboursement enregistré' }).click();
  await expect(page.getByText('0,60', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile-loyalty.png', fullPage: true });
});
