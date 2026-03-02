const { test, expect } = require('@playwright/test');

test('Apply payload falls back oldDishName/oldRecipeKey when option dataset is missing', async ({ page }) => {
  let capturedBody = null;
  const payloadLogs = [];

  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Apply payload:')) payloadLogs.push(text);
  });

  await page.route('**/apply', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      try {
        capturedBody = JSON.parse(request.postData() || '{}');
      } catch (_error) {
        capturedBody = null;
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        status: 'patch_required',
        patch: {
          patchVersion: 1,
          createdAt: new Date().toISOString(),
          menu: 'dinner',
          week: 2,
          day: 'Wednesday',
          dishSlotId: 'dinner:week2:Wednesday:Dessert',
          dishSlotKey: 'Dessert',
          oldDishName: '',
          oldRecipeKey: '',
          recipeData: {
            title: 'Payload Fallback Recipe',
            servings: '1',
            ingredients: [{ name: 'pear', qty: 1, unit: 'ea', notes: '' }],
            steps: ['Bake.'],
            sourceUrl: 'https://example.com',
            generatedHtml: '<h2>Payload Fallback Recipe</h2>'
          }
        }
      })
    });
  });

  await page.route('**/dispatchPatch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 'Dispatched workflow' })
    });
  });

  await page.goto('/');
  await page.waitForSelector('#updateTab');
  await page.click('#updateTab');
  await page.selectOption('#updateMenuSelect', 'dinner');
  await page.selectOption('#updateWeekSelect', '2');
  await page.selectOption('#updateDaySelect', 'Wednesday');

  const dessertOptionValue = await page.locator('#updateDishSelect option').evaluateAll((options) => {
    const match = options.find((option) => /Dessert/i.test(option.textContent || ''));
    return match ? match.value : '';
  });
  expect(dessertOptionValue).not.toBe('');
  await page.selectOption('#updateDishSelect', dessertOptionValue);

  await page.evaluate(() => {
    const select = document.getElementById('updateDishSelect');
    const selected = select && select.options.length ? select.options[select.selectedIndex] : null;
    if (selected) {
      delete selected.dataset.dishName;
      delete selected.dataset.recipeKey;
      selected.textContent = 'Dessert: Pear & Almond Crostata';
    }
  });

  await page.evaluate(() => {
    window.__chefDashboardTestHooks.setExtractedRecipeDraft({
      title: 'Payload Fallback Recipe',
      servings: '1',
      ingredients: [{ name: 'pear', qty: 1, unit: 'ea', notes: '' }],
      steps: ['Bake.'],
      sourceUrl: 'https://example.com'
    });
  });

  await page.fill('#adminSecretInput', 'test-secret');
  await page.click('#applyUpdateBtn');

  await expect(page.locator('#updateStatus')).toContainText('Update queued in GitHub Actions');
  expect(capturedBody).toBeTruthy();
  expect((capturedBody.dishName || '').trim()).toBe('Pear & Almond Crostata');
  expect((capturedBody.recipeKey || '').trim()).toBe('Pear & Almond Crostata');

  const payloadLog = payloadLogs.find((entry) => entry.includes('"dishName":"Pear & Almond Crostata"') && entry.includes('"recipeKey":"Pear & Almond Crostata"'));
  expect(Boolean(payloadLog)).toBeTruthy();
});
