const { test, expect } = require('@playwright/test');

test('Update Recipe works with corrupted localStorage and persists Week 2 Wednesday Pear Almond Crostata', async ({ page }) => {
  const criticalErrors = [];
  const criticalPattern = /(TypeError|indexOf is not a function|Cannot read properties of null)/i;

  page.on('pageerror', (error) => {
    const message = String(error && error.message ? error.message : error);
    if (criticalPattern.test(message)) criticalErrors.push(`pageerror: ${message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (criticalPattern.test(text)) criticalErrors.push(`console: ${text}`);
  });

  await page.addInitScript(() => {
    if (localStorage.getItem('__chefDashboardCorruptSeeded') === '1') return;
    localStorage.setItem('chefDashboardApiBaseUrl', '[object Object]');
    localStorage.setItem('chefDashboardRecipeOverridesV1', '{"invalid":true}');
    localStorage.setItem('chefDashboardRecipeOverrides', '123');
    localStorage.setItem('chefDashboardLegacyNoise', 'null');
    localStorage.setItem('__chefDashboardCorruptSeeded', '1');
  });

  await page.goto('/');
  await page.waitForSelector('#updateTab');
  await page.reload();
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

  const draftRecipe = {
    title: 'Pear Almond Crostata',
    servings: '1 tart',
    ingredients: [
      { name: 'all-purpose flour', qty: 2, unit: 'cups' },
      { name: 'granulated sugar', qty: 3, unit: 'tbsp' },
      { name: 'salt', qty: 0.5, unit: 'tsp' },
      { name: 'unsalted butter', qty: 10, unit: 'tbsp' },
      { name: 'ice water', qty: 5, unit: 'tbsp' },
      { name: 'almond paste', qty: 8, unit: 'oz' },
      { name: 'Bartlett pears', qty: 3, unit: 'large' },
      { name: 'ground ginger', qty: 0.5, unit: 'tsp' },
      { name: 'fresh lemon juice', qty: 1, unit: 'tbsp' },
      { name: 'egg', qty: 1, unit: 'ea' },
      { name: 'coarse sugar', qty: 1, unit: 'tbsp' }
    ],
    steps: [
      'Prepare crust and chill.',
      'Fill with almond paste and pears.',
      'Bake until golden.'
    ]
  };

  await page.evaluate((recipe) => {
    window.__chefDashboardTestHooks.setExtractedRecipeDraft(recipe);
  }, draftRecipe);

  await page.fill('#adminSecretInput', '');
  await page.click('#applyUpdateBtn');
  await expect(page.locator('#updateStatus')).toContainText('saved locally');

  await page.reload();
  await page.waitForSelector('#weekSelect');

  await page.selectOption('#weekSelect', '2');
  await page.selectOption('#daySelect', 'Wednesday');
  await expect(page.locator('#menuRow')).toContainText('Pear Almond Crostata');

  await expect(page.locator('#ingredientsContainer')).toContainText(/pears/i);
  await expect(page.locator('#ingredientsContainer')).toContainText(/almond paste/i);
  await expect(page.locator('#ingredientsContainer')).toContainText(/all-purpose flour/i);
  await expect(page.locator('#ingredientsContainer')).toContainText(/unsalted butter/i);
  await expect(page.locator('#ingredientsContainer')).toContainText(/granulated sugar/i);

  const overrides = await page.evaluate(() => window.__chefDashboardTestHooks.getStoredOverrides());
  expect(Array.isArray(overrides)).toBeTruthy();
  expect(
    overrides.some((entry) =>
      entry &&
      entry.week === '2' &&
      entry.day === 'Wednesday' &&
      entry.dishSlotKey === 'Dessert' &&
      (entry.dishName || '').toLowerCase() === 'pear almond crostata'
    )
  ).toBeTruthy();

  expect(criticalErrors).toEqual([]);
});
