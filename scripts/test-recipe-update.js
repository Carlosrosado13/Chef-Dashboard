const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:4173';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not become ready at ${url}`));
          return;
        }
        setTimeout(ping, 500);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not become ready at ${url}`));
          return;
        }
        setTimeout(ping, 500);
      });
    };
    ping();
  });
}

async function run() {
  let browser;
  let serverProcess;
  try {
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      shell: true,
      stdio: 'ignore'
    });
    await waitForServer(BASE_URL, 120000);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const criticalErrors = [];
    const criticalPattern = /(indexOf is not a function|Cannot read properties of null)/i;

    page.on('pageerror', (error) => {
      const message = String(error && error.message ? error.message : error);
      if (criticalPattern.test(message)) criticalErrors.push(message);
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (criticalPattern.test(text)) criticalErrors.push(text);
    });

    await page.addInitScript(() => {
      if (localStorage.getItem('__chefDashboardCorruptSeeded') === '1') return;
      localStorage.setItem('chefDashboardRecipeOverridesV1', '{}');
      localStorage.setItem('chefDashboardApiBaseUrl', '[object Object]');
      localStorage.setItem('__chefDashboardCorruptSeeded', '1');
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#updateTab');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#updateTab');
    assert(criticalErrors.length === 0, `Unexpected critical errors after corrupted storage reload: ${criticalErrors.join(' | ')}`);

    const override = {
      menu: 'DINNER',
      week: 'Week 2',
      day: ' wednesday ',
      dishSlotKey: ' dessert ',
      oldDishName: '',
      oldRecipeKey: '',
      dishName: 'Pear Almond Crostata',
      recipeKey: 'Pear Almond Crostata',
      recipeData: {
        title: 'Pear Almond Crostata',
        servings: '1 tart',
        sourceUrl: 'https://www.bakedbyanintrovert.com/pear-almond-crostata/',
        ingredients: [
          { name: 'pear', qty: 3, unit: 'ea' },
          { name: 'almond paste', qty: 8, unit: 'oz' },
          { name: 'flour', qty: 2, unit: 'cups' },
          { name: 'butter', qty: 10, unit: 'tbsp' },
          { name: 'lemon juice', qty: 1, unit: 'tbsp' }
        ],
        steps: ['Prepare dough.', 'Layer almond paste and pear.', 'Bake until golden.']
      }
    };

    const applyResult = await page.evaluate((payload) => {
      const hooks = window.__chefDashboardTestHooks;
      if (!hooks) return { applied: false, persisted: false };
      const applied = hooks.applySingleRecipeOverride(payload);
      const persisted = hooks.persistRecipeOverride(payload);
      hooks.rebuildIngredientCheckerData();
      return { applied, persisted };
    }, override);
    assert(applyResult.applied === true, 'applySingleRecipeOverride did not apply the override.');
    assert(applyResult.persisted === true, 'Override was not persisted to storage.');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#weekSelect');
    assert(criticalErrors.length === 0, `Unexpected critical errors after override reload: ${criticalErrors.join(' | ')}`);

    const storedRecipe = await page.evaluate(() => {
      const hooks = window.__chefDashboardTestHooks;
      if (!hooks) return null;
      return hooks.getRecipeFromStore('dinner', 2, 'Pear Almond Crostata');
    });
    assert(storedRecipe && typeof storedRecipe === 'object', 'Recipe missing from recipesStore[2] after reload.');

    await page.selectOption('#weekSelect', '2');
    await page.selectOption('#daySelect', 'Wednesday');
    await page.waitForSelector('#menuRow .menu-item-block');

    const menuText = await page.locator('#menuRow').innerText();
    assert(/Pear Almond Crostata/i.test(menuText), 'Updated dish did not appear in menu for Week 2 Wednesday.');

    await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('#menuRow .menu-item-block'));
      const target = blocks.find((block) => /Pear Almond Crostata/i.test(block.textContent || ''));
      if (target) target.click();
    });

    await page.waitForTimeout(100);
    const ingredientsText = await page.locator('#ingredientsContainer').innerText();
    assert(/pear/i.test(ingredientsText), 'Ingredient checker does not include pear.');
    assert(/almond/i.test(ingredientsText), 'Ingredient checker does not include almond.');

    const recipeHtml = await page.locator('#recipeDetails').innerHTML();
    assert(/Pear Almond Crostata/i.test(recipeHtml), 'renderRecipe() did not show updated recipe HTML.');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  }
}

run()
  .then(() => {
    console.log('✅ TEST PASSED');
    process.exit(0);
  })
  .catch((error) => {
    if (error) console.error(error.message || error);
    console.log('❌ TEST FAILED');
    process.exit(1);
  });
