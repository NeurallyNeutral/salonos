import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

test('merchant guided demo has a dedicated simulated email scene, Back and restart', async ({
  page,
}) => {
  const errors = [];
  const writes = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.method() !== 'GET') writes.push(request.url());
  });
  await page.goto('/demo/merchant');
  await expect(page.getByRole('heading', { name: 'Un commerce, un espace clair.' })).toBeVisible();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByLabel('Adresse e-mail pour la scène simulée').fill('demo@example.test');
  await page.getByRole('button', { name: 'Voir la vérification' }).click();
  await expect(
    page.getByRole('heading', { name: 'Regardez votre boîte de réception.' }),
  ).toBeVisible();
  await expect(page.getByText('aucun e-mail envoyé')).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByLabel('Adresse e-mail pour la scène simulée')).toHaveValue(
    'demo@example.test',
  );
  await page.getByRole('button', { name: /Continuer/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Regardez votre boîte de réception.' }),
  ).toBeVisible();
  await mkdir('artifacts/v3', { recursive: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/v3/demo-merchant.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Un commerce, un espace clair.' })).toBeVisible();
  await expect(page.locator('#count')).toHaveText('01 / 06');
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByLabel('Adresse e-mail pour la scène simulée').fill('demo@example.test');
  await page.getByRole('button', { name: 'Voir la vérification' }).click();
  await expect(
    page.getByRole('heading', { name: 'Regardez votre boîte de réception.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page.getByRole('heading', { name: 'Un commerce, un espace clair.' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 360);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('customer guided demo advances to merchant action and resets on mobile', async ({ page }) => {
  const writes = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') writes.push(request.url());
  });
  await mkdir('artifacts/v3', { recursive: true });
  await page.goto('/demo/customer');
  await expect(
    page.getByRole('heading', { name: 'Un lieu à découvrir, à son rythme.' }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Continuer/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Le commerce sait quoi faire ensuite.' }),
  ).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'artifacts/v3/demo-customer.png', fullPage: true });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Un lieu à découvrir, à son rythme.' }),
  ).toBeVisible();
  await expect(page.locator('#count')).toHaveText('01 / 05');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Continuer/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Le commerce sait quoi faire ensuite.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: 'Une réponse sans ambiguïté.' })).toBeVisible();
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page.locator('#count')).toHaveText('01 / 05');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 360);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  expect(writes).toEqual([]);
});

test('standalone guided build works without Worker or D1', async ({ page }) => {
  const files = new Map([
    ['/demo/merchant/', ['dist/guided-demo/demo/merchant/index.html', 'text/html']],
    ['/demo/customer/', ['dist/guided-demo/demo/customer/index.html', 'text/html']],
    ['/demo.css', ['dist/guided-demo/demo.css', 'text/css']],
    ['/demo.js', ['dist/guided-demo/demo.js', 'application/javascript']],
  ]);
  const server = createServer(async (request, response) => {
    const entry = files.get(request.url);
    if (!entry) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': entry[1] });
    response.end(await readFile(entry[0]));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/demo/merchant/');
    await expect(
      page.getByRole('heading', { name: 'Un commerce, un espace clair.' }),
    ).toBeVisible();
    await page.goto(base + '/demo/customer/');
    await expect(
      page.getByRole('heading', { name: 'Un lieu à découvrir, à son rythme.' }),
    ).toBeVisible();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
