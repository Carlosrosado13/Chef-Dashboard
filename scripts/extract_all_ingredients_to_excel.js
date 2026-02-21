#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ExcelJS = require('exceljs');

const ROOT_DIR = path.resolve(__dirname, '..');
const RECIPES_DINNER_PATH = path.join(ROOT_DIR, 'recipes.js');
const RECIPES_LUNCH_PATH = path.join(ROOT_DIR, 'recipeslunch.js');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'ingredient_categories.xlsx');

const CATEGORY_VALUES = [
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

async function createWorkbook(ingredients) {
  const workbook = new ExcelJS.Workbook();

  const ingredientsSheet = workbook.addWorksheet('Ingredients');
  ingredientsSheet.columns = [
    { header: 'Ingredient', key: 'ingredient', width: 46 },
    { header: 'Category', key: 'category', width: 24 },
  ];
  ingredientsSheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const ingredient of ingredients) {
    ingredientsSheet.addRow({ ingredient, category: '' });
  }

  for (let rowNum = 2; rowNum <= 9999; rowNum += 1) {
    const categoryCell = ingredientsSheet.getCell(`B${rowNum}`);
    categoryCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['=Categories!$A$1:$A$11'],
      showErrorMessage: true,
      errorTitle: 'Invalid Category',
      error: 'Select a category from the dropdown.',
    };
  }

  const categoriesSheet = workbook.addWorksheet('Categories');
  categoriesSheet.getColumn(1).width = 24;
  for (const category of CATEGORY_VALUES) {
    categoriesSheet.addRow([category]);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  await workbook.xlsx.writeFile(OUTPUT_PATH);
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

  const uniqueByLower = new Map();
  for (const ingredient of extractedIngredients) {
    const key = ingredient.toLowerCase();
    if (!uniqueByLower.has(key)) {
      uniqueByLower.set(key, ingredient);
    }
  }

  const uniqueIngredients = Array.from(uniqueByLower.values());
  await createWorkbook(uniqueIngredients);

  console.log(`Total extracted: ${extractedIngredients.length}`);
  console.log(`Unique ingredients: ${uniqueIngredients.length}`);
  console.log(`Output path: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
