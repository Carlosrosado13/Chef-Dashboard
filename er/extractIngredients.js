#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ExcelJS = require('exceljs');

const ROOT_DIR = path.resolve(__dirname, '..');
const DINNER_FILE = path.join(ROOT_DIR, 'recipes.js');
const LUNCH_FILE = path.join(ROOT_DIR, 'recipeslunch.js');
const CATEGORY_FILE = path.join(ROOT_DIR, 'data', 'ingredient_categories.json');
const ALIAS_FILE = path.join(ROOT_DIR, 'data', 'ingredient_aliases.json');
const INVENTORY_FILE = path.join(ROOT_DIR, 'data', 'inventory.json');
const OUTPUT_MASTER_FILE = path.join(ROOT_DIR, 'data', 'ingredients_master.xlsx');
const EXPORT_DIR = path.join(ROOT_DIR, 'data', 'exports');
const REPORT_DIR = path.join(ROOT_DIR, 'data', 'reports');
const MISSING_CATEGORY_REPORT = path.join(REPORT_DIR, 'missing_categories.json');

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

function singularizeToken(token) {
  if (!token || token.length < 4) return token;
  const uncountables = new Set(['bass', 'glass', 'couscous', 'hummus']);
  if (uncountables.has(token)) return token;

  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('oes') && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && !token.endsWith('ss') && !token.endsWith('us')) {
    return token.slice(0, -1);
  }
  return token;
}

function normalizeIngredientName(raw) {
  let value = stripHtml(raw).toLowerCase();
  value = value.replace(/\([^)]*\)/g, ' ');
  value = value.replace(/[\u2013\u2014]/g, '-');

  const descriptorPattern = /,\s*(chopped|diced|minced|sliced|julienne|julienned|halved|peeled|shredded|grated|trimmed|drained|beaten|optional|fresh|for garnish|garnish)(?:\s+.*)?$/i;
  value = value.replace(descriptorPattern, '');

  value = value.replace(/\s+/g, ' ').trim();
  if (!value) return '';

  const words = value.split(' ').map((word) => {
    if (!/^[a-z]+$/.test(word)) return word;
    return singularizeToken(word);
  });

  return words.join(' ').replace(/\s+/g, ' ').trim();
}

function canonicalize(name, aliasLookup) {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return '';
  return aliasLookup[normalized] || normalized;
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

function loadJsonObject(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return parsed;
}

function loadAliasDictionary() {
  const rawAliases = loadJsonObject(ALIAS_FILE, 'Alias dictionary');
  const aliasLookup = {};

  for (const [rawVariant, rawCanonical] of Object.entries(rawAliases)) {
    const variant = normalizeIngredientName(rawVariant);
    const canonical = normalizeIngredientName(rawCanonical);
    if (!variant || !canonical) continue;
    aliasLookup[variant] = canonical;
  }

  return aliasLookup;
}

function loadCategoryDictionary(aliasLookup) {
  const rawCategories = loadJsonObject(CATEGORY_FILE, 'Category dictionary');
  const categoryLookup = {};

  for (const [rawKey, rawCategory] of Object.entries(rawCategories)) {
    const canonicalKey = canonicalize(rawKey, aliasLookup);
    if (!canonicalKey) continue;

    const category = normalizeCategory(rawCategory);
    if (!category) {
      throw new Error(
        `Invalid category "${rawCategory}" for ingredient key "${rawKey}". Allowed: ${VALID_CATEGORIES.join(', ')}`
      );
    }

    if (!Object.prototype.hasOwnProperty.call(categoryLookup, canonicalKey)) {
      categoryLookup[canonicalKey] = category;
    }
  }

  return categoryLookup;
}

function loadInventory(aliasLookup) {
  if (!fs.existsSync(INVENTORY_FILE)) {
    return {};
  }

  const rawInventory = loadJsonObject(INVENTORY_FILE, 'Inventory file');
  const inventory = {};

  for (const [rawName, rawItem] of Object.entries(rawInventory)) {
    const canonical = canonicalize(rawName, aliasLookup);
    if (!canonical) continue;

    const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
    inventory[canonical] = {
      qty: item.qty ?? null,
      unit: item.unit ? String(item.unit).trim() : '',
    };
  }

  return inventory;
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

function parseQuantityAndUnit(value) {
  const cleaned = stripHtml(value).replace(/,/g, '.');
  if (!cleaned) {
    return { quantity: null, unit: '', raw: '' };
  }

  const unicodeFractionMap = {
    '1/2': ['½', 'Â½'],
    '1/4': ['¼', 'Â¼'],
    '3/4': ['¾', 'Â¾'],
    '1/3': ['⅓', 'â…“'],
    '2/3': ['⅔', 'â…”'],
    '1/8': ['⅛', 'â…›'],
  };

  let normalized = cleaned;
  for (const [ascii, variants] of Object.entries(unicodeFractionMap)) {
    for (const variant of variants) {
      normalized = normalized.split(variant).join(ascii);
    }
  }

  const mixedMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const numerator = Number(mixedMatch[2]);
    const denominator = Number(mixedMatch[3]);
    if (denominator) {
      return {
        quantity: whole + numerator / denominator,
        unit: (mixedMatch[4] || '').trim(),
        raw: cleaned,
      };
    }
  }

  const fractionMatch = normalized.match(/^(\d+)\/(\d+)\s*(.*)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator) {
      return {
        quantity: numerator / denominator,
        unit: (fractionMatch[3] || '').trim(),
        raw: cleaned,
      };
    }
  }

  const numericMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*(.*)$/);
  if (numericMatch) {
    return {
      quantity: Number(numericMatch[1]),
      unit: (numericMatch[2] || '').trim(),
      raw: cleaned,
    };
  }

  return { quantity: null, unit: '', raw: cleaned };
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
      const ingredient = stripHtml(cells[0]);
      if (ingredient && ingredient.toLowerCase() !== 'ingredient') {
        const amount = parseQuantityAndUnit(cells[1] || '');
        rows.push({ ingredient, amount });
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

function collectIngredientsByWeek(dataObject, aliasLookup, categoryLookup, missingCategories) {
  const byWeek = initWeekMaps();

  for (const [weekKey, weekRecipes] of Object.entries(dataObject)) {
    const weekNum = Number(weekKey);
    if (!WEEK_NUMBERS.includes(weekNum)) continue;
    if (!weekRecipes || typeof weekRecipes !== 'object') continue;

    const weekMap = byWeek[weekNum];

    for (const recipeHtml of Object.values(weekRecipes)) {
      for (const row of extractIngredientRowsFromRecipeHtml(recipeHtml)) {
        const canonical = canonicalize(row.ingredient, aliasLookup);
        if (!canonical) continue;

        const category = categoryLookup[canonical] || UNCATEGORIZED;
        if (category === UNCATEGORIZED) {
          missingCategories.add(canonical);
        }

        if (!weekMap.has(canonical)) {
          weekMap.set(canonical, {
            ingredient: canonical,
            category,
            count: 0,
            measurements: [],
          });
        }

        const entry = weekMap.get(canonical);
        entry.count += 1;
        entry.measurements.push({
          quantity: row.amount.quantity,
          unit: row.amount.unit,
          raw: row.amount.raw,
        });
      }
    }
  }

  return byWeek;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function summarizeMeasurements(measurements) {
  const byUnit = new Map();
  const rawValues = new Set();

  for (const measurement of measurements) {
    const quantity = measurement.quantity;
    const unit = (measurement.unit || '').trim().toLowerCase();

    if (Number.isFinite(quantity) && unit) {
      byUnit.set(unit, (byUnit.get(unit) || 0) + quantity);
    } else if (measurement.raw) {
      rawValues.add(measurement.raw);
    }
  }

  if (byUnit.size === 1 && rawValues.size === 0) {
    const [[unit, total]] = byUnit.entries();
    return {
      totalQuantity: formatNumber(total),
      unit,
      notes: '',
    };
  }

  const notes = [];
  if (byUnit.size > 1) {
    const unitParts = [];
    for (const [unit, total] of byUnit.entries()) {
      unitParts.push(`${formatNumber(total)} ${unit}`.trim());
    }
    notes.push(`Mixed units: ${unitParts.join(', ')}`);
  }
  if (rawValues.size) {
    notes.push(`Details: ${Array.from(rawValues).slice(0, 6).join('; ')}`);
  }

  return {
    totalQuantity: '',
    unit: '',
    notes: notes.join(' | '),
  };
}

function toSortedEntries(weekMap) {
  return Array.from(weekMap.values()).sort((a, b) => a.ingredient.localeCompare(b.ingredient));
}

function toSortedGroceryEntries(weekMap) {
  const entries = [];
  for (const item of weekMap.values()) {
    const summary = summarizeMeasurements(item.measurements);
    entries.push({
      ingredient: item.ingredient,
      category: item.category,
      totalQuantity: summary.totalQuantity,
      unit: summary.unit,
      notes: summary.notes,
      count: item.count,
    });
  }

  return entries.sort((a, b) => {
    if (a.category === b.category) return a.ingredient.localeCompare(b.ingredient);
    return a.category.localeCompare(b.category);
  });
}

function combineWeekMaps(weekMapA, weekMapB) {
  const combined = new Map();

  function mergeFrom(source) {
    for (const [key, entry] of source.entries()) {
      if (!combined.has(key)) {
        combined.set(key, {
          ingredient: key,
          category: entry.category,
          count: 0,
          measurements: [],
        });
      }

      const target = combined.get(key);
      target.count += entry.count;
      target.measurements.push(...entry.measurements);
      if (target.category === UNCATEGORIZED && entry.category !== UNCATEGORIZED) {
        target.category = entry.category;
      }
    }
  }

  mergeFrom(weekMapA);
  mergeFrom(weekMapB);
  return combined;
}

async function writeIngredientWorkbook(filePath, entries) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ingredients');

  sheet.columns = [
    { header: 'Ingredient', key: 'ingredient', width: 45 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'Notes', key: 'notes', width: 42 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const entry of entries) {
    const summary = summarizeMeasurements(entry.measurements);
    sheet.addRow({
      ingredient: entry.ingredient,
      category: entry.category,
      quantity: summary.totalQuantity,
      unit: summary.unit,
      notes: summary.notes || `Occurrences: ${entry.count}`,
    });
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await workbook.xlsx.writeFile(filePath);
}

async function writeGroceryWorkbook(filePath, entries) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Grocery List');

  sheet.columns = [
    { header: 'Ingredient', key: 'ingredient', width: 45 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'TotalQuantity', key: 'totalQuantity', width: 14 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'Notes', key: 'notes', width: 42 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const entry of entries) {
    sheet.addRow({
      ingredient: entry.ingredient,
      category: entry.category,
      totalQuantity: entry.totalQuantity,
      unit: entry.unit,
      notes: entry.notes,
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

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function buildInventoryReport(week, meal, groceryEntries, inventoryLookup) {
  const items = groceryEntries.map((entry) => {
    const inventory = inventoryLookup[entry.ingredient];
    const hasItem = Boolean(inventory);

    let note = '';
    if (!hasItem) {
      note = 'Missing in inventory';
    } else {
      const groceryUnit = (entry.unit || '').trim().toLowerCase();
      const inventoryUnit = (inventory.unit || '').trim().toLowerCase();
      if (!entry.totalQuantity) {
        note = 'Grocery quantity unavailable';
      } else if (inventory.qty == null) {
        note = 'Inventory quantity missing';
      } else if (groceryUnit && inventoryUnit && groceryUnit !== inventoryUnit) {
        note = `Unit differs: grocery=${groceryUnit}, inventory=${inventoryUnit}`;
      }
    }

    return {
      ingredient: entry.ingredient,
      category: entry.category,
      status: hasItem ? 'have' : 'need',
      grocery: {
        qty: entry.totalQuantity || null,
        unit: entry.unit || '',
      },
      inventory: hasItem ? inventory : null,
      note,
    };
  });

  return {
    week,
    meal,
    generatedAt: new Date().toISOString(),
    items,
  };
}

function writeMissingCategoryReport(missingCategories) {
  const list = Array.from(missingCategories).sort();
  const payload = {
    generatedAt: new Date().toISOString(),
    count: list.length,
    ingredients: list,
  };
  writeJsonFile(MISSING_CATEGORY_REPORT, payload);
  return payload;
}

async function writeWeekOutputs(week, dinnerWeekMap, lunchWeekMap, inventoryLookup) {
  const dinnerIngredientPath = path.join(EXPORT_DIR, `ingredients_dinner_week${week}.xlsx`);
  const lunchIngredientPath = path.join(EXPORT_DIR, `ingredients_lunch_week${week}.xlsx`);
  await writeIngredientWorkbook(dinnerIngredientPath, toSortedEntries(dinnerWeekMap));
  await writeIngredientWorkbook(lunchIngredientPath, toSortedEntries(lunchWeekMap));

  const dinnerGroceryEntries = toSortedGroceryEntries(dinnerWeekMap);
  const lunchGroceryEntries = toSortedGroceryEntries(lunchWeekMap);
  const combinedWeekMap = combineWeekMaps(dinnerWeekMap, lunchWeekMap);
  const combinedGroceryEntries = toSortedGroceryEntries(combinedWeekMap);

  const dinnerGroceryPath = path.join(EXPORT_DIR, `grocery_dinner_week${week}.xlsx`);
  const lunchGroceryPath = path.join(EXPORT_DIR, `grocery_lunch_week${week}.xlsx`);
  const combinedGroceryPath = path.join(EXPORT_DIR, `grocery_combined_week${week}.xlsx`);

  await writeGroceryWorkbook(dinnerGroceryPath, dinnerGroceryEntries);
  await writeGroceryWorkbook(lunchGroceryPath, lunchGroceryEntries);
  await writeGroceryWorkbook(combinedGroceryPath, combinedGroceryEntries);

  const dinnerInventoryReport = buildInventoryReport(week, 'dinner', dinnerGroceryEntries, inventoryLookup);
  const lunchInventoryReport = buildInventoryReport(week, 'lunch', lunchGroceryEntries, inventoryLookup);
  const combinedInventoryReport = buildInventoryReport(week, 'combined', combinedGroceryEntries, inventoryLookup);

  writeJsonFile(path.join(REPORT_DIR, `missing_from_inventory_week${week}_dinner.json`), dinnerInventoryReport);
  writeJsonFile(path.join(REPORT_DIR, `missing_from_inventory_week${week}_lunch.json`), lunchInventoryReport);
  writeJsonFile(path.join(REPORT_DIR, `missing_from_inventory_week${week}_combined.json`), combinedInventoryReport);
}

function logMissingCategories(report) {
  if (!report.count) {
    console.log('Missing categories: 0');
    return;
  }

  console.log(`Missing categories: ${report.count}`);
  console.log('Ingredients assigned to UNCATEGORIZED:');
  for (const item of report.ingredients) {
    console.log(`- ${item}`);
  }
  console.log(`Missing category report: ${MISSING_CATEGORY_REPORT}`);
}

async function main() {
  const aliasLookup = loadAliasDictionary();
  const categoryLookup = loadCategoryDictionary(aliasLookup);
  const inventoryLookup = loadInventory(aliasLookup);

  const dinnerData = loadDinnerData();
  const lunchData = loadLunchData();

  assertWeekLikeData('Dinner', dinnerData);
  assertWeekLikeData('Lunch', lunchData);

  console.log('Dinner keys sample:', Object.keys(dinnerData).slice(0, 5));
  console.log('Lunch keys sample:', Object.keys(lunchData).slice(0, 5));
  console.log('Alias entries:', Object.keys(aliasLookup).length);
  console.log('Category dictionary entries:', Object.keys(categoryLookup).length);

  const missingCategories = new Set();
  const dinnerByWeek = collectIngredientsByWeek(dinnerData, aliasLookup, categoryLookup, missingCategories);
  const lunchByWeek = collectIngredientsByWeek(lunchData, aliasLookup, categoryLookup, missingCategories);

  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  for (const week of WEEK_NUMBERS) {
    await writeWeekOutputs(week, dinnerByWeek[week], lunchByWeek[week], inventoryLookup);
  }

  const masterRows = buildMasterRows(dinnerByWeek, lunchByWeek);
  await writeMasterWorkbook(masterRows);

  const totalIngredients = masterRows.reduce(
    (sum, row) => sum + WEEK_NUMBERS.reduce((acc, week) => acc + row.dinner[week] + row.lunch[week], 0),
    0
  );

  const missingReport = writeMissingCategoryReport(missingCategories);

  console.log(`Total ingredients found: ${totalIngredients}`);
  console.log(`Unique ingredient count: ${masterRows.length}`);
  console.log(`Wrote master workbook: ${OUTPUT_MASTER_FILE}`);
  console.log(`Wrote ingredient + grocery exports to: ${EXPORT_DIR}`);
  console.log(`Wrote reports to: ${REPORT_DIR}`);

  logMissingCategories(missingReport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
