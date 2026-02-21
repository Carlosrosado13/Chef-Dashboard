#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ExcelJS = require('exceljs');

const ROOT_DIR = path.resolve(__dirname, '..');
const DINNER_FILE = path.join(ROOT_DIR, 'recipes.js');
const LUNCH_FILE = path.join(ROOT_DIR, 'recipeslunch.js');
const CATEGORY_FILE = path.join(ROOT_DIR, 'data', 'ingredient_categories.json');
const OUTPUT_MASTER_FILE = path.join(ROOT_DIR, 'data', 'ingredients_master.xlsx');
const EXPORT_DIR = path.join(ROOT_DIR, 'data', 'exports');

const VALID_CATEGORIES = [
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

const UNCATEGORIZED = 'UNCATEGORIZED';
const WEEK_NUMBERS = [1, 2, 3, 4];

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

function stripHtml(value) {
  return decodeEntities(String(value || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIngredient(value) {
  return stripHtml(value).replace(/\s+/g, ' ').trim();
}

function normalizeIngredientKey(value) {
  return normalizeIngredient(value).toLowerCase();
}

function normalizeCategory(value) {
  const input = String(value || '').trim().toLowerCase();
  for (const category of VALID_CATEGORIES) {
    if (category.toLowerCase() === input) {
      return category;
    }
  }
  return null;
}

function evaluateFileIntoSandbox(filePath, sandbox) {
  let source = fs.readFileSync(filePath, 'utf8');
  source = source.replace(/^\uFEFF/, '');
  source = source.replace(/\bexport\s+const\s+/g, 'const ');
  source = source.replace(/\bexport\s+default\s+/g, '');
  vm.runInContext(source, sandbox, { filename: path.basename(filePath) });
}

function buildRuntimeSandbox() {
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  return vm.createContext(runtime);
}

function loadDinnerData() {
  const sandbox = buildRuntimeSandbox();
  evaluateFileIntoSandbox(DINNER_FILE, sandbox);

  const dinnerData = sandbox.recipesData;
  if (!dinnerData || typeof dinnerData !== 'object') {
    throw new Error('Could not find dinner data on globalThis.recipesData from recipes.js');
  }
  return dinnerData;
}

function loadLunchData() {
  const sandbox = buildRuntimeSandbox();
  evaluateFileIntoSandbox(LUNCH_FILE, sandbox);

  const fromModule = sandbox.module && sandbox.module.exports && sandbox.module.exports.recipesLunchData;
  const fromGlobal = sandbox.recipesLunchData;
  const lunchData = fromModule || fromGlobal;

  if (!lunchData || typeof lunchData !== 'object') {
    throw new Error('Could not find lunch data via module.exports.recipesLunchData or globalThis.recipesLunchData from recipeslunch.js');
  }
  return lunchData;
}

function assertWeekLikeData(datasetName, data) {
  const keys = Object.keys(data);
  if (!keys.length) {
    throw new Error(`${datasetName} data is empty`);
  }

  const numericWeekKeys = keys.filter((key) => Number.isFinite(Number(key)));
  if (!numericWeekKeys.length) {
    throw new Error(`${datasetName} data does not contain numeric week keys`);
  }

  const sampleWeekKey = numericWeekKeys[0];
  const sampleWeek = data[sampleWeekKey];
  if (!sampleWeek || typeof sampleWeek !== 'object') {
    throw new Error(`${datasetName} week ${sampleWeekKey} is not an object`);
  }

  const hasRecipeHtml = Object.values(sampleWeek).some((value) => typeof value === 'string' && value.includes('<'));
  if (!hasRecipeHtml) {
    throw new Error(`${datasetName} week ${sampleWeekKey} has no HTML recipe strings`);
  }
}

function loadCategoryDictionary() {
  if (!fs.existsSync(CATEGORY_FILE)) {
    throw new Error(`Category dictionary not found: ${CATEGORY_FILE}`);
  }

  const raw = fs.readFileSync(CATEGORY_FILE, 'utf8').replace(/^\uFEFF/, '');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse category dictionary JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Category dictionary must be a JSON object');
  }

  const normalized = {};
  for (const [rawKey, rawCategory] of Object.entries(parsed)) {
    const key = normalizeIngredientKey(rawKey);
    if (!key) continue;

    const category = normalizeCategory(rawCategory);
    if (!category) {
      throw new Error(
        `Invalid category "${rawCategory}" for ingredient key "${rawKey}". Allowed: ${VALID_CATEGORIES.join(', ')}`
      );
    }

    if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
      normalized[key] = category;
    }
  }

  return normalized;
}

function parseQuantityAndUnit(value) {
  const cleaned = stripHtml(value).replace(/,/g, '.');
  if (!cleaned) {
    return { quantity: '', unit: '' };
  }

  const numericMatch = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)\s*(.*)$/);
  if (numericMatch) {
    return {
      quantity: numericMatch[1],
      unit: (numericMatch[2] || '').trim(),
    };
  }

  return { quantity: '', unit: cleaned };
}

function extractIngredientRowsFromRecipeHtml(recipeHtml) {
  const rows = [];
  if (typeof recipeHtml !== 'string' || !recipeHtml) {
    return rows;
  }

  let cursor = 0;
  while (cursor < recipeHtml.length) {
    const trStart = recipeHtml.indexOf('<tr', cursor);
    if (trStart === -1) break;

    const trEnd = recipeHtml.indexOf('</tr>', trStart);
    if (trEnd === -1) break;

    const rowHtml = recipeHtml.slice(trStart, trEnd + 5);
    const cells = [];
    const tdRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtml(tdMatch[1]));
    }

    if (cells.length > 0) {
      const ingredient = normalizeIngredient(cells[0]);
      if (ingredient && ingredient.toLowerCase() !== 'ingredient') {
        const amount = parseQuantityAndUnit(cells[1] || '');
        rows.push({ ingredient, quantity: amount.quantity, unit: amount.unit });
      }
    }

    cursor = trEnd + 5;
  }

  return rows;
}

function initWeekMaps() {
  const byWeek = {};
  for (const week of WEEK_NUMBERS) {
    byWeek[week] = new Map();
  }
  return byWeek;
}

function collectIngredientsByWeek(dataObject, categoryLookup, missingCategories) {
  const byWeek = initWeekMaps();

  for (const [weekKey, weekRecipes] of Object.entries(dataObject)) {
    const weekNum = Number(weekKey);
    if (!WEEK_NUMBERS.includes(weekNum)) continue;
    if (!weekRecipes || typeof weekRecipes !== 'object') continue;

    const weekMap = byWeek[weekNum];

    for (const recipeHtml of Object.values(weekRecipes)) {
      for (const row of extractIngredientRowsFromRecipeHtml(recipeHtml)) {
        const key = normalizeIngredientKey(row.ingredient);
        if (!key) continue;

        const category = categoryLookup[key] || UNCATEGORIZED;
        if (category === UNCATEGORIZED) {
          missingCategories.add(key);
        }

        if (!weekMap.has(key)) {
          weekMap.set(key, {
            ingredient: row.ingredient,
            category,
            quantity: row.quantity,
            unit: row.unit,
            count: 0,
          });
        }

        const entry = weekMap.get(key);
        entry.count += 1;

        if (!entry.quantity && row.quantity) {
          entry.quantity = row.quantity;
        }
        if (!entry.unit && row.unit) {
          entry.unit = row.unit;
        }
      }
    }
  }

  return byWeek;
}

function toSortedEntries(weekMap) {
  return Array.from(weekMap.values()).sort((a, b) => a.ingredient.localeCompare(b.ingredient));
}

async function writeWeeklyWorkbook(filePath, entries) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ingredients');

  sheet.columns = [
    { header: 'Ingredient', key: 'ingredient', width: 45 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'Count', key: 'count', width: 10 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const entry of entries) {
    sheet.addRow({
      ingredient: entry.ingredient,
      category: entry.category,
      quantity: entry.quantity,
      unit: entry.unit,
      count: entry.count,
    });
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await workbook.xlsx.writeFile(filePath);
}

function buildMasterRows(dinnerByWeek, lunchByWeek) {
  const master = new Map();

  function applyWeek(weekMap, mealKey, weekNum) {
    for (const [ingredientKey, item] of weekMap.entries()) {
      if (!master.has(ingredientKey)) {
        master.set(ingredientKey, {
          ingredient: item.ingredient,
          category: item.category,
          dinner: { 1: 0, 2: 0, 3: 0, 4: 0 },
          lunch: { 1: 0, 2: 0, 3: 0, 4: 0 },
        });
      }

      const row = master.get(ingredientKey);
      row[mealKey][weekNum] += item.count;
      if (row.category === UNCATEGORIZED && item.category !== UNCATEGORIZED) {
        row.category = item.category;
      }
    }
  }

  for (const weekNum of WEEK_NUMBERS) {
    applyWeek(dinnerByWeek[weekNum], 'dinner', weekNum);
    applyWeek(lunchByWeek[weekNum], 'lunch', weekNum);
  }

  return Array.from(master.values()).sort((a, b) => a.ingredient.localeCompare(b.ingredient));
}

async function writeMasterWorkbook(masterRows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ingredients Master');

  sheet.columns = [
    { header: 'Ingredient', key: 'ingredient', width: 45 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Dinner Week 1', key: 'd1', width: 14 },
    { header: 'Dinner Week 2', key: 'd2', width: 14 },
    { header: 'Dinner Week 3', key: 'd3', width: 14 },
    { header: 'Dinner Week 4', key: 'd4', width: 14 },
    { header: 'Lunch Week 1', key: 'l1', width: 14 },
    { header: 'Lunch Week 2', key: 'l2', width: 14 },
    { header: 'Lunch Week 3', key: 'l3', width: 14 },
    { header: 'Lunch Week 4', key: 'l4', width: 14 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of masterRows) {
    sheet.addRow({
      ingredient: row.ingredient,
      category: row.category,
      d1: row.dinner[1],
      d2: row.dinner[2],
      d3: row.dinner[3],
      d4: row.dinner[4],
      l1: row.lunch[1],
      l2: row.lunch[2],
      l3: row.lunch[3],
      l4: row.lunch[4],
    });
  }

  fs.mkdirSync(path.dirname(OUTPUT_MASTER_FILE), { recursive: true });
  await workbook.xlsx.writeFile(OUTPUT_MASTER_FILE);
}

async function writeWeeklyExports(dinnerByWeek, lunchByWeek) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  for (const weekNum of WEEK_NUMBERS) {
    const dinnerFile = path.join(EXPORT_DIR, `ingredients_dinner_week${weekNum}.xlsx`);
    const lunchFile = path.join(EXPORT_DIR, `ingredients_lunch_week${weekNum}.xlsx`);

    await writeWeeklyWorkbook(dinnerFile, toSortedEntries(dinnerByWeek[weekNum]));
    await writeWeeklyWorkbook(lunchFile, toSortedEntries(lunchByWeek[weekNum]));
  }
}

function logMissingCategories(missingCategories) {
  if (!missingCategories.size) {
    console.log('Missing categories: 0');
    return;
  }

  const sorted = Array.from(missingCategories).sort();
  console.log(`Missing categories: ${sorted.length}`);
  console.log('Ingredients assigned to UNCATEGORIZED:');
  for (const item of sorted) {
    console.log(`- ${item}`);
  }
}

async function main() {
  const dinnerData = loadDinnerData();
  const lunchData = loadLunchData();

  assertWeekLikeData('Dinner', dinnerData);
  assertWeekLikeData('Lunch', lunchData);

  const categoryLookup = loadCategoryDictionary();

  console.log('Dinner keys sample:', Object.keys(dinnerData).slice(0, 5));
  console.log('Lunch keys sample:', Object.keys(lunchData).slice(0, 5));
  console.log('Category dictionary entries:', Object.keys(categoryLookup).length);

  const missingCategories = new Set();
  const dinnerByWeek = collectIngredientsByWeek(dinnerData, categoryLookup, missingCategories);
  const lunchByWeek = collectIngredientsByWeek(lunchData, categoryLookup, missingCategories);

  await writeWeeklyExports(dinnerByWeek, lunchByWeek);

  const masterRows = buildMasterRows(dinnerByWeek, lunchByWeek);
  await writeMasterWorkbook(masterRows);

  const totalIngredients = masterRows.reduce(
    (sum, row) => sum + WEEK_NUMBERS.reduce((acc, week) => acc + row.dinner[week] + row.lunch[week], 0),
    0
  );

  console.log(`Total ingredients found: ${totalIngredients}`);
  console.log(`Unique ingredient count: ${masterRows.length}`);
  console.log(`Wrote master workbook: ${OUTPUT_MASTER_FILE}`);
  console.log(`Wrote weekly exports to: ${EXPORT_DIR}`);

  logMissingCategories(missingCategories);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
