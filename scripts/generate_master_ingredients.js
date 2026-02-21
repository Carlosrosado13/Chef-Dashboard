#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ExcelJS = require('exceljs');

const ROOT_DIR = path.resolve(__dirname, '..');
const RECIPES_DINNER_PATH = path.join(ROOT_DIR, 'recipes.js');
const RECIPES_LUNCH_PATH = path.join(ROOT_DIR, 'recipeslunch.js');
const MASTER_INGREDIENTS_JS_PATH = path.join(ROOT_DIR, 'data', 'master_ingredients.js');
const MASTER_INGREDIENTS_XLSX_PATH = path.join(ROOT_DIR, 'ingredients_master.xlsx');

const RULES = [
  { category: 'Protein', keywords: ['chicken', 'beef', 'pork', 'shrimp', 'salmon', 'fish', 'lamb', 'turkey', 'sausage', 'egg'] },
  { category: 'Dairy', keywords: ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'parmesan', 'feta', 'mozzarella'] },
  { category: 'Greens', keywords: ['lettuce', 'arugula', 'spinach', 'kale', 'romaine', 'mixed greens'] },
  { category: 'Vegetable', keywords: ['onion', 'garlic', 'carrot', 'zucchini', 'tomato', 'pepper', 'mushroom', 'potato', 'eggplant'] },
  { category: 'Fruit', keywords: ['apple', 'berry', 'lemon', 'orange', 'mango', 'banana'] },
  { category: 'Starch', keywords: ['rice', 'pasta', 'bread', 'flour', 'polenta', 'gnocchi'] },
  { category: 'Dry', keywords: ['flour', 'cornstarch', 'cornmeal', 'sugar', 'cocoa'] },
  { category: 'Spices', keywords: ['salt', 'pepper', 'paprika', 'cumin', 'chili', 'thyme', 'rosemary'] },
  { category: 'Alcohol', keywords: ['wine', 'brandy', 'beer'] },
  { category: 'Can', keywords: ['canned', 'tomato paste', 'canned beans'] },
  { category: 'Frozen', keywords: ['frozen'] },
];

function decodeHtmlEntities(value) {
  if (!value) return '';

  const named = value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');

  return named
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanText(value) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function evalScriptInSandbox(filePath, sandbox) {
  let code = fs.readFileSync(filePath, 'utf8');
  code = code.replace(/^\uFEFF/, '');
  code = code.replace(/\bexport\s+const\s+/g, 'const ');
  code = code.replace(/\bexport\s+default\s+/g, '');

  vm.runInContext(code, sandbox, { filename: path.basename(filePath) });
}

function getRecipeHtmlStrings(dataset) {
  const htmlStrings = [];
  if (!dataset || typeof dataset !== 'object') return htmlStrings;

  for (const weekRecipes of Object.values(dataset)) {
    if (!weekRecipes || typeof weekRecipes !== 'object') continue;
    for (const recipeHtml of Object.values(weekRecipes)) {
      if (typeof recipeHtml === 'string') {
        htmlStrings.push(recipeHtml);
      }
    }
  }

  return htmlStrings;
}

function extractIngredientsFromHtml(recipeHtml) {
  const ingredients = [];
  const tbodyMatches = recipeHtml.match(/<tbody[\s\S]*?<\/tbody>/gi) || [];

  for (const tbody of tbodyMatches) {
    const trMatches = tbody.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const tr of trMatches) {
      const firstTdMatch = tr.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i);
      if (!firstTdMatch) continue;

      const ingredient = cleanText(firstTdMatch[1]);
      if (!ingredient) continue;
      if (ingredient.toLowerCase() === 'ingredient') continue;

      ingredients.push(ingredient);
    }
  }

  return ingredients;
}

function classifyIngredient(ingredient) {
  const lower = ingredient.toLowerCase();

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        return rule.category;
      }
    }
  }

  return 'Uncategorized';
}

function escapeForDoubleQuotedJsString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildMasterIngredientsJs(entries) {
  const lines = [];
  lines.push('const masterIngredients = [');

  for (const entry of entries) {
    const name = escapeForDoubleQuotedJsString(entry.name);
    const category = escapeForDoubleQuotedJsString(entry.category);
    lines.push(`  { name: "${name}", category: "${category}" },`);
  }

  lines.push('];');
  lines.push('');
  lines.push('export default masterIngredients;');
  lines.push('');

  return lines.join('\n');
}

async function writeExcel(entries) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ingredients');

  sheet.columns = [
    { header: 'Ingredient', key: 'ingredient', width: 48 },
    { header: 'Category', key: 'category', width: 20 },
  ];

  for (const entry of entries) {
    sheet.addRow({ ingredient: entry.name, category: entry.category });
  }

  await workbook.xlsx.writeFile(MASTER_INGREDIENTS_XLSX_PATH);
}

async function main() {
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  const sandbox = vm.createContext(runtime);

  evalScriptInSandbox(RECIPES_DINNER_PATH, sandbox);
  evalScriptInSandbox(RECIPES_LUNCH_PATH, sandbox);

  const dinnerData = runtime.recipesData;
  const lunchData = runtime.recipesDataLunch || runtime.recipesLunchData;

  if (!dinnerData) {
    throw new Error('recipes.js did not populate globalThis.recipesData');
  }

  if (!lunchData) {
    throw new Error('recipeslunch.js did not populate globalThis.recipesDataLunch or globalThis.recipesLunchData');
  }

  const allRecipeHtml = [
    ...getRecipeHtmlStrings(dinnerData),
    ...getRecipeHtmlStrings(lunchData),
  ];

  const extractedIngredients = [];
  for (const recipeHtml of allRecipeHtml) {
    extractedIngredients.push(...extractIngredientsFromHtml(recipeHtml));
  }

  const deduped = new Map();
  for (const ingredient of extractedIngredients) {
    const key = ingredient.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, ingredient);
    }
  }

  const entries = Array.from(deduped.values())
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, category: classifyIngredient(name) }));

  fs.mkdirSync(path.dirname(MASTER_INGREDIENTS_JS_PATH), { recursive: true });
  fs.writeFileSync(MASTER_INGREDIENTS_JS_PATH, buildMasterIngredientsJs(entries), 'utf8');

  await writeExcel(entries);

  console.log(`Total extracted: ${extractedIngredients.length}`);
  console.log(`Unique ingredients: ${entries.length}`);
  console.log(`JS output: ${MASTER_INGREDIENTS_JS_PATH}`);
  console.log(`XLSX output: ${MASTER_INGREDIENTS_XLSX_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
