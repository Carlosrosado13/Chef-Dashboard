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
];

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
function categorize(nameRaw) {
  const name = nameRaw.toLowerCase();

  const rules = [
    { cat: "Greens", keys: ["lettuce", "arugula", "spinach", "kale", "romaine", "mixed greens"] },
    { cat: "Protein", keys: ["chicken", "beef", "pork", "lamb", "turkey", "sausage", "shrimp", "salmon", "fish", "haddock", "egg"] },
    { cat: "Dairy", keys: ["milk", "cream", "cheese", "butter", "yogurt", "parmesan", "feta", "mozzarella"] },
    { cat: "Fruit", keys: ["apple", "berries", "berry", "lemon", "orange", "mango", "pear"] },
    { cat: "Vegetable", keys: ["onion", "garlic", "carrot", "zucchini", "tomato", "pepper", "mushroom", "potato", "eggplant", "cucumber", "leeks", "shallot"] },
    { cat: "Starch", keys: ["rice", "pasta", "bread", "polenta", "gnocchi", "potato"] },
    { cat: "Dry", keys: ["flour", "cornmeal", "cornstarch", "sugar", "cocoa", "breadcrumbs", "bread crumbs"] },
    { cat: "Spices", keys: ["salt", "pepper", "paprika", "cumin", "thyme", "rosemary", "chili", "red pepper flakes"] },
    { cat: "Alcohol", keys: ["wine", "brandy", "beer", "rum"] },
    { cat: "Can", keys: ["canned", "tomato paste", "beans"] },
    { cat: "Frozen", keys: ["frozen"] },
  ];

  const ingredientStats = new Map();

function addIngredientUse(ingredient, weekNum) {
  if (!ingredient || !weekNum) return;

  const key = ingredient.toLowerCase();

  if (!ingredientStats.has(key)) {
    ingredientStats.set(key, {
      name: ingredient,
      category: categorize(ingredient),
      weeks: emptyWeekCounts(),
    });
  }

  ingredientStats.get(key).weeks[weekNum] += 1;
}

  for (const r of rules) {
    if (r.keys.some(k => name.includes(k))) return r.cat;
  }
  return "Uncategorized";
}
function collectIngredientsByWeek(dataObject) {
  if (!dataObject || typeof dataObject !== 'object') return;

  for (const [weekKey, weekRecipes] of Object.entries(dataObject)) {
    const weekNum = Number(weekKey);
    if (!weekNum || typeof weekRecipes !== 'object') continue;

    for (const recipeHtml of Object.values(weekRecipes)) {
      if (typeof recipeHtml !== 'string') continue;

      const ingredients = extractIngredientsFromRecipeHtml(recipeHtml);
      for (const ingredient of ingredients) {
        addIngredientUse(ingredient, weekNum);
      }
    }
  }
}

  for (const weekRecipes of Object.values(dataObject)) {
    if (!weekRecipes || typeof weekRecipes !== 'object') continue;
    for (const recipeHtml of Object.values(weekRecipes)) {
      if (typeof recipeHtml === 'string') {
        htmlStrings.push(recipeHtml);
      }
    }
  }

  return htmlStrings;

function extractIngredientsFromRecipeHtml(recipeHtml) {
  const ingredients = [];
  const tbodyBlocks = recipeHtml.match(/<tbody[\s\S]*?<\/tbody>/gi) || [];

  for (const tbody of tbodyBlocks) {
    const rows = tbody.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const firstCellMatch = row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i);
      if (!firstCellMatch) continue;

      const ingredient = normalizeIngredient(firstCellMatch[1]);
      if (!ingredient) continue;
      if (ingredient.toLowerCase() === 'ingredient') continue;

      ingredients.push(ingredient);
    }
  }

  return ingredients;
}

async function writeWorkbook(uniqueIngredients) {
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

  for (const { name, category, weeks } of ingredientStats.values()) {
  ingredientsSheet.addRow({
    ingredient: name,
    category,
    week1: weeks[1],
    week2: weeks[2],
    week3: weeks[3],
    week4: weeks[4],
  });
}

  const categoriesSheet = workbook.addWorksheet('Categories');
  categoriesSheet.getColumn(1).width = 22;
  for (const category of CATEGORIES) {
    categoriesSheet.addRow([category]);
  }

  for (let row = 2; row <= 9999; row += 1) {
    ingredientsSheet.getCell(`B${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Categories!$A$1:$A$11'],
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: 'Please select a category from the dropdown list.',
    };
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  await workbook.xlsx.writeFile(OUTPUT_FILE);
}

async function main() {
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  const sandbox = vm.createContext(runtime);

  evaluateFileIntoSandbox(DINNER_FILE, sandbox);
  evaluateFileIntoSandbox(LUNCH_FILE, sandbox);

  const dinnerData = runtime.recipesData;
  const lunchData = runtime.recipesDataLunch || runtime.recipesLunchData;

  if (!dinnerData) {
    throw new Error('Could not find dinner data on globalThis.recipesData');
  }
  if (!lunchData) {
    throw new Error('Could not find lunch data on globalThis.recipesDataLunch or globalThis.recipesLunchData');
  }

  collectIngredientsByWeek(dinnerData);
  collectIngredientsByWeek(lunchData);

  const uniqueMap = new Map();
  for (const ingredient of allIngredients) {
    const key = ingredient.toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, ingredient);
    }
  }

  const uniqueIngredients = Array.from(uniqueMap.values());
  await writeWorkbook(uniqueIngredients);

  console.log(`Total ingredients found: ${allIngredients.length}`);
  console.log(`Unique ingredient count: ${uniqueIngredients.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
  
});
