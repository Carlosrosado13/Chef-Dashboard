#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ExcelJS = require('exceljs');

const ROOT_DIR = path.resolve(__dirname, '..');
const DINNER_FILE = path.join(ROOT_DIR, 'recipes.js');
const LUNCH_FILE = path.join(ROOT_DIR, 'recipeslunch.js');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data', 'ingredients_master.xlsx');

const CATEGORIES = [
  'Protein',
  'Starch',
  'Dry',
  'Can',
  'Frozen',
  'Vegetable',
  'Fruit',
  'Greens',
  'Spices',
  'Alcohol',
  'Dairy',
  'Uncategorized',
];

const ingredientStats = new Map();

function emptyWeekCounts() {
  return { 1: 0, 2: 0, 3: 0, 4: 0 };
}

function decodeEntities(value) {
  if (!value) return '';
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeIngredient(value) {
  const decoded = decodeEntities(value);
  return decoded.replace(/\s+/g, ' ').trim();
}

function evaluateFileIntoSandbox(filePath, sandbox) {
  let source = fs.readFileSync(filePath, 'utf8');
  source = source.replace(/^\uFEFF/, '');
  source = source.replace(/\bexport\s+const\s+/g, 'const ');
  source = source.replace(/\bexport\s+default\s+/g, '');
  vm.runInContext(source, sandbox, { filename: path.basename(filePath) });
}

function loadDinnerData() {
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  const sandbox = vm.createContext(runtime);

  evaluateFileIntoSandbox(DINNER_FILE, sandbox);

  if (!runtime.recipesData || typeof runtime.recipesData !== 'object') {
    throw new Error('Could not find dinner data on globalThis.recipesData');
  }

  return runtime.recipesData;
}

function loadLunchData() {
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  const sandbox = vm.createContext(runtime);

  evaluateFileIntoSandbox(LUNCH_FILE, sandbox);

  const fromModule = runtime.module && runtime.module.exports && runtime.module.exports.recipesLunchData;
  const fromGlobal = runtime.recipesLunchData;
  const lunchData = fromModule || fromGlobal;

  if (!lunchData || typeof lunchData !== 'object') {
    throw new Error('Could not find lunch data via module.exports.recipesLunchData or globalThis.recipesLunchData');
  }

  return lunchData;
}

function assertWeekLikeData(datasetName, data) {
  const keys = Object.keys(data);
  if (!keys.length) {
    throw new Error(`${datasetName} data is empty`);
  }

  const numericKeys = keys.filter((k) => Number.isFinite(Number(k)));
  if (!numericKeys.length) {
    throw new Error(`${datasetName} data does not have numeric week keys`);
  }

  const sampleWeek = data[numericKeys[0]];
  if (!sampleWeek || typeof sampleWeek !== 'object') {
    throw new Error(`${datasetName} week ${numericKeys[0]} is not an object`);
  }

  const hasHtmlRecipe = Object.values(sampleWeek).some((v) => typeof v === 'string' && v.includes('<'));
  if (!hasHtmlRecipe) {
    throw new Error(`${datasetName} sample week ${numericKeys[0]} has no recipe HTML strings`);
  }
}

function categorize(nameRaw) {
  const name = nameRaw.toLowerCase();
  const rules = [
    { cat: 'Greens', keys: ['lettuce', 'arugula', 'spinach', 'kale', 'romaine', 'mixed greens'] },
    { cat: 'Protein', keys: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'sausage', 'shrimp', 'salmon', 'fish', 'haddock', 'egg'] },
    { cat: 'Dairy', keys: ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'parmesan', 'feta', 'mozzarella'] },
    { cat: 'Fruit', keys: ['apple', 'berries', 'berry', 'lemon', 'orange', 'mango', 'pear'] },
    { cat: 'Vegetable', keys: ['onion', 'garlic', 'carrot', 'zucchini', 'tomato', 'pepper', 'mushroom', 'potato', 'eggplant', 'cucumber', 'leeks', 'shallot'] },
    { cat: 'Starch', keys: ['rice', 'pasta', 'bread', 'polenta', 'gnocchi', 'potato'] },
    { cat: 'Dry', keys: ['flour', 'cornmeal', 'cornstarch', 'sugar', 'cocoa', 'breadcrumbs', 'bread crumbs'] },
    { cat: 'Spices', keys: ['salt', 'pepper', 'paprika', 'cumin', 'thyme', 'rosemary', 'chili', 'red pepper flakes'] },
    { cat: 'Alcohol', keys: ['wine', 'brandy', 'beer', 'rum'] },
    { cat: 'Can', keys: ['canned', 'tomato paste', 'beans'] },
    { cat: 'Frozen', keys: ['frozen'] },
  ];

  for (const rule of rules) {
    if (rule.keys.some((key) => name.includes(key))) {
      return rule.cat;
    }
  }
  return 'Uncategorized';
}

function addIngredientUse(ingredient, weekNum) {
  if (!ingredient || !weekNum) return;

  const key = ingredient.toLowerCase();
  if (!ingredientStats.has(key)) {
    ingredientStats.set(key, {
      name: ingredient,
      category: categorize(ingredient),
      weeks: emptyWeekCounts(),
      total: 0,
    });
  }

  const entry = ingredientStats.get(key);
  if (!entry.weeks[weekNum]) {
    entry.weeks[weekNum] = 0;
  }
  entry.weeks[weekNum] += 1;
  entry.total += 1;
}

function extractIngredientsFromRecipeHtml(recipeHtml) {
  const ingredients = [];
  let cursor = 0;

  while (cursor < recipeHtml.length) {
    const trStart = recipeHtml.indexOf('<tr', cursor);
    if (trStart === -1) break;

    const trEnd = recipeHtml.indexOf('</tr>', trStart);
    if (trEnd === -1) break;

    const rowHtml = recipeHtml.slice(trStart, trEnd);
    const tdStart = rowHtml.indexOf('<td');
    if (tdStart !== -1) {
      const tdOpenEnd = rowHtml.indexOf('>', tdStart);
      const tdClose = tdOpenEnd === -1 ? -1 : rowHtml.indexOf('</td>', tdOpenEnd + 1);

      if (tdOpenEnd !== -1 && tdClose !== -1) {
        const firstCellRaw = rowHtml
          .slice(tdOpenEnd + 1, tdClose)
          .replace(/<[^>]*>/g, ' ');
        const ingredient = normalizeIngredient(firstCellRaw);

        if (ingredient && ingredient.toLowerCase() !== 'ingredient') {
          ingredients.push(ingredient);
        }
      }
    }

    cursor = trEnd + 5;
  }

  return ingredients;
}

function collectIngredientsByWeek(dataObject) {
  for (const [weekKey, weekRecipes] of Object.entries(dataObject)) {
    const weekNum = Number(weekKey);
    if (!weekNum || !weekRecipes || typeof weekRecipes !== 'object') continue;

    for (const recipeHtml of Object.values(weekRecipes)) {
      if (typeof recipeHtml !== 'string') continue;
      const ingredients = extractIngredientsFromRecipeHtml(recipeHtml);
      for (const ingredient of ingredients) {
        addIngredientUse(ingredient, weekNum);
      }
    }
  }
}

async function writeWorkbook() {
  const workbook = new ExcelJS.Workbook();

  const ingredientsSheet = workbook.addWorksheet('Ingredients');
  ingredientsSheet.columns = [
    { header: 'Ingredient', key: 'ingredient', width: 45 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Week 1', key: 'week1', width: 10 },
    { header: 'Week 2', key: 'week2', width: 10 },
    { header: 'Week 3', key: 'week3', width: 10 },
    { header: 'Week 4', key: 'week4', width: 10 },
  ];
  ingredientsSheet.views = [{ state: 'frozen', ySplit: 1 }];

  const sorted = Array.from(ingredientStats.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const { name, category, weeks } of sorted) {
    ingredientsSheet.addRow({
      ingredient: name,
      category,
      week1: weeks[1] || 0,
      week2: weeks[2] || 0,
      week3: weeks[3] || 0,
      week4: weeks[4] || 0,
    });
  }

  const categoriesSheet = workbook.addWorksheet('Categories');
  categoriesSheet.getColumn(1).width = 22;
  for (const category of CATEGORIES) {
    categoriesSheet.addRow([category]);
  }

  const lastIngredientRow = Math.max(2, ingredientsSheet.rowCount);
  for (let row = 2; row <= lastIngredientRow; row += 1) {
    ingredientsSheet.getCell(`B${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=Categories!$A$1:$A$${CATEGORIES.length}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: 'Please select a category from the dropdown list.',
    };
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  await workbook.xlsx.writeFile(OUTPUT_FILE);
}

async function main() {
  const dinnerData = loadDinnerData();
  const lunchData = loadLunchData();

  assertWeekLikeData('Dinner', dinnerData);
  assertWeekLikeData('Lunch', lunchData);

  console.log('Dinner keys sample:', Object.keys(dinnerData).slice(0, 5));
  console.log('Lunch keys sample:', Object.keys(lunchData).slice(0, 5));

  collectIngredientsByWeek(dinnerData);
  collectIngredientsByWeek(lunchData);

  await writeWorkbook();

  const totalIngredients = Array.from(ingredientStats.values()).reduce((sum, entry) => sum + entry.total, 0);
  console.log(`Total ingredients found: ${totalIngredients}`);
  console.log(`Unique ingredient count: ${ingredientStats.size}`);
  console.log(`Wrote workbook: ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
