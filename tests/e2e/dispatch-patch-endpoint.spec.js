const { test, expect } = require('@playwright/test');

test('Apply Update dispatches patch to /api/dispatchPatch', async ({ page }) => {
  let dispatchCalled = false;
  let dispatchStatus = 0;

  await page.route('**/apply', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
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
            title: 'Dispatch Test Recipe',
            servings: '1',
            ingredients: [{ name: 'pear', qty: 1, unit: 'ea', notes: '' }],
            steps: ['Bake.'],
            sourceUrl: 'https://example.com',
            generatedHtml: '<h2>Dispatch Test Recipe</h2>'
          }
        }
      })
    });
  });

  await page.route('**/api/dispatchPatch', async (route) => {
    dispatchCalled = true;
    dispatchStatus = 200;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        status: 'Dispatched workflow',
        runUrl: 'https://github.com/example/repo/actions/runs/123'
      })
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
  await page.selectOption('#updateDishSelect', dessertOptionValue);

  await page.evaluate(() => {
    window.__chefDashboardTestHooks.setExtractedRecipeDraft({
      title: 'Dispatch Test Recipe',
      servings: '1',
      ingredients: [{ name: 'pear', qty: 1, unit: 'ea', notes: '' }],
      steps: ['Bake.'],
      sourceUrl: 'https://example.com'
    });
  });

  await page.fill('#adminSecretInput', 'test-secret');
  await page.click('#applyUpdateBtn');

  await expect(page.locator('#updateStatus')).toContainText('Update queued in GitHub Actions');
  expect(dispatchCalled).toBeTruthy();
  expect(dispatchStatus).toBe(200);
});
