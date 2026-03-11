#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readRecipesJson, RECIPES_JSON_PATH } = require('./loadRecipesJson');

const ROOT_DIR = path.resolve(__dirname, '..');
const DINNER_MENU_SOURCE_FILE = path.join(ROOT_DIR, 'menu_overview.js');
const DINNER_MENU_OVERRIDES_FILE = path.join(ROOT_DIR, 'dinner_menu_data.js');
const LUNCH_MENU_SOURCE_FILE = path.join(ROOT_DIR, 'lunch_menu_data.js');

function usageAndExit(message) {
  if (message) console.error(message);
  console.error('Usage: node scripts/applyRecipePatch.js path/to/patch.json');
  process.exit(1);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeDay(day) {
  const map = {
    mon: 'Monday', monday: 'Monday',
    tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
    wed: 'Wednesday', wednesday: 'Wednesday',
    thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
    fri: 'Friday', friday: 'Friday',
    sat: 'Saturday', saturday: 'Saturday',
    sun: 'Sunday', sunday: 'Sunday',
  };
  const key = String(day || '').trim().toLowerCase();
  return map[key] || day;
}

function ingredientToLine(ingredient) {
  if (typeof ingredient === 'string') return ingredient.trim();
  if (!ingredient || typeof ingredient !== 'object') return '';

  const original = String(ingredient.original || '').trim();
  if (original) return original;

  const name = String(ingredient.name || '').trim();
  if (!name) return '';
  const qty = ingredient.qty == null ? '' : String(ingredient.qty).trim();
  const unit = String(ingredient.unit || '').trim();
  const notes = String(ingredient.notes || '').trim();
  const amount = [qty, unit].filter(Boolean).join(' ').trim();
  const line = amount ? `${amount} ${name}` : name;
  return notes ? `${line} (${notes})` : line;
}

function normalizeRecipeData(recipeData) {
  const title = String(recipeData.title || '').trim();
  const ingredientsRaw = Array.isArray(recipeData.ingredients) ? recipeData.ingredients : [];
  const stepsRaw = Array.isArray(recipeData.steps) ? recipeData.steps : [];
  const servings = String(recipeData.servings || recipeData.yield || '').trim();
  const sourceUrl = String(recipeData.sourceUrl || '').trim();
  const generatedHtml = String(recipeData.generatedHtml || '').trim();

  return {
    title,
    servings,
    sourceUrl,
    generatedHtml,
    ingredients: ingredientsRaw.map(ingredientToLine).map((line) => line.trim()).filter(Boolean),
    steps: stepsRaw.map((step) => String(step || '').trim()).filter(Boolean),
  };
}

function validatePatch(patch) {
  if (!patch || typeof patch !== 'object') throw new Error('Patch must be a JSON object');

  const menu = String(patch.menu || '').trim().toLowerCase();
  if (!['dinner', 'lunch'].includes(menu)) throw new Error('patch.menu must be lunch or dinner');

  const week = Number(patch.week);
  if (!Number.isInteger(week) || week < 1 || week > 4) throw new Error('patch.week must be an integer 1-4');

  const day = normalizeDay(patch.day);
  if (!day) throw new Error('patch.day is required');

  const dishSlotId = String(patch.dishSlotId || '').trim();
  const dishSlotKey = String(patch.dishSlotKey || '').trim();
  if (!dishSlotId || !dishSlotKey) throw new Error('patch.dishSlotId and patch.dishSlotKey are required');

  const recipeData = patch.recipeData;
  if (!recipeData || typeof recipeData !== 'object') throw new Error('patch.recipeData is required');

  const normalized = normalizeRecipeData(recipeData);
  if (!normalized.title) throw new Error('patch.recipeData.title is required');

  return {
    menu,
    week,
    day,
    dishSlotId,
    dishSlotKey,
    oldDishName: String(patch.oldDishName || '').trim(),
    oldRecipeKey: String(patch.oldRecipeKey || '').trim(),
    recipeData: normalized,
  };
}

function buildRecipeHtml(recipeData) {
  if (recipeData.generatedHtml) return recipeData.generatedHtml;

  const title = escapeHtml(recipeData.title);
  const yieldRow = recipeData.servings ? `<p><strong>Yield:</strong> ${escapeHtml(recipeData.servings)}</p>` : '';
  const ingredientRows = recipeData.ingredients
    .map((line) => `<tr><td>${escapeHtml(line)}</td><td></td></tr>`)
    .join('');
  const stepRows = recipeData.steps
    .map((step) => `<li><p>${escapeHtml(step)}</p></li>`)
    .join('');

  return `<h2>${title}</h2>${yieldRow}<h3>Ingredients</h3><table><thead><tr><th>Ingredient</th><th>Amount</th></tr></thead><tbody>${ingredientRows}</tbody></table><h3>Method</h3><ol type="1">${stepRows}</ol>`;
}

function normalizeRecipeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveExistingRecipeKey(weekData, candidates) {
  const keys = Object.keys(weekData || {});
  const cleanCandidates = candidates.map((s) => String(s || '').trim()).filter(Boolean);

  for (const candidate of cleanCandidates) {
    const exact = keys.find((key) => key === candidate);
    if (exact) return exact;
  }

  const mapped = keys.map((key) => ({ key, norm: normalizeRecipeKey(key) }));
  for (const candidate of cleanCandidates) {
    const norm = normalizeRecipeKey(candidate);
    const match = mapped.find((entry) => entry.norm === norm);
    if (match) return match.key;
  }

  for (const candidate of cleanCandidates) {
    const norm = normalizeRecipeKey(candidate);
    const match = mapped.find((entry) => entry.norm.includes(norm) || norm.includes(entry.norm));
    if (match) return match.key;
  }

  return '';
}

function replaceMenuSlotValue({ source, weekKey, dayKey, slotKey, newTitle }) {
  const pattern = new RegExp(
    `("${escapeRegExp(weekKey)}"\\s*:\\s*\\{[\\s\\S]*?"${escapeRegExp(dayKey)}"\\s*:\\s*\\{[\\s\\S]*?"${escapeRegExp(slotKey)}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`
  );
  if (!pattern.test(source)) throw new Error(`Could not find menu slot: week=${weekKey}, day=${dayKey}, slot=${slotKey}`);
  return source.replace(pattern, `$1"${newTitle.replace(/"/g, '\\"')}"`);
}

function updateDinnerOverrideIfPresent(source, week, day, slotKey, newTitle) {
  const singleQuoted = newTitle.replace(/'/g, "\\'");
  const slotPatternBracket = new RegExp(
    `(dinnerMenuData\\['${escapeRegExp(String(week))}'\\]\\.${escapeRegExp(day)}\\['${escapeRegExp(slotKey)}'\\]\\s*=\\s*)'(?:[^'\\\\]|\\\\.)*'`
  );
  if (slotPatternBracket.test(source)) return source.replace(slotPatternBracket, `$1'${singleQuoted}'`);

  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(slotKey)) {
    const dotPattern = new RegExp(
      `(dinnerMenuData\\['${escapeRegExp(String(week))}'\\]\\.${escapeRegExp(day)}\\.${escapeRegExp(slotKey)}\\s*=\\s*)'(?:[^'\\\\]|\\\\.)*'`
    );
    if (dotPattern.test(source)) return source.replace(dotPattern, `$1'${singleQuoted}'`);
  }
  return source;
}

function validateUpdatedRecipeData(recipes, menu, week, key) {
  const menuRecipes = recipes[menu];
  if (!menuRecipes || typeof menuRecipes !== 'object' || Array.isArray(menuRecipes)) {
    throw new Error(`recipes.json missing ${menu} recipe data after patch.`);
  }

  const weekData = menuRecipes[String(week)] || menuRecipes[week];
  if (!weekData || typeof weekData !== 'object' || Array.isArray(weekData)) {
    throw new Error(`recipes.json week ${week} missing after patch.`);
  }

  if (!Object.prototype.hasOwnProperty.call(weekData, key)) {
    throw new Error(`recipes.json updated key "${key}" missing after patch.`);
  }

  if (typeof weekData[key] !== 'string') {
    throw new Error(`recipes.json updated key "${key}" is not a string after patch.`);
  }
}

function runGlobalValidator() {
  const validatorPath = path.join(ROOT_DIR, 'scripts', 'validateRecipesData.js');
  const result = spawnSync(process.execPath, [validatorPath], { cwd: ROOT_DIR, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`validateRecipesData failed:\n${(result.stderr || result.stdout || '').trim()}`);
  }
}

function rebuildIngredientIndex() {
  const generatorPath = path.join(ROOT_DIR, 'scripts', 'generate_master_ingredients.js');
  const result = spawnSync(process.execPath, [generatorPath, '--js-only'], { cwd: ROOT_DIR, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`generate_master_ingredients failed:\n${(result.stderr || result.stdout || '').trim()}`);
  }
}

function main() {
  const patchFile = process.argv[2];
  if (!patchFile) usageAndExit();

  const patchPath = path.resolve(process.cwd(), patchFile);
  if (!fs.existsSync(patchPath)) usageAndExit(`Patch file not found: ${patchPath}`);

  let patchJson;
  try {
    patchJson = JSON.parse(readUtf8(patchPath));
  } catch (error) {
    usageAndExit(`Invalid patch JSON: ${error.message}`);
  }

  const patch = validatePatch(patchJson);
  const recipes = readRecipesJson().all;
  const menuRecipes = recipes[patch.menu] && typeof recipes[patch.menu] === 'object' && !Array.isArray(recipes[patch.menu])
    ? recipes[patch.menu]
    : (recipes[patch.menu] = {});
  const weekKey = String(patch.week);
  const weekRecipes = menuRecipes[weekKey] && typeof menuRecipes[weekKey] === 'object' && !Array.isArray(menuRecipes[weekKey])
    ? menuRecipes[weekKey]
    : (menuRecipes[weekKey] = {});

  const oldKeyCandidates = [patch.oldRecipeKey, patch.oldDishName, patch.recipeData.title].filter(Boolean);
  const oldKey = resolveExistingRecipeKey(weekRecipes, oldKeyCandidates);
  weekRecipes[patch.recipeData.title] = buildRecipeHtml(patch.recipeData);
  validateUpdatedRecipeData(recipes, patch.menu, patch.week, patch.recipeData.title);

  const writes = [{ filePath: RECIPES_JSON_PATH, content: `${JSON.stringify(recipes, null, 2)}\n` }];

  if (patch.menu === 'lunch') {
    const lunchSource = readUtf8(LUNCH_MENU_SOURCE_FILE);
    const updatedLunchSource = replaceMenuSlotValue({
      source: lunchSource,
      weekKey: `Week ${patch.week}`,
      dayKey: patch.day,
      slotKey: patch.dishSlotKey,
      newTitle: patch.recipeData.title,
    });
    if (updatedLunchSource !== lunchSource) writes.push({ filePath: LUNCH_MENU_SOURCE_FILE, content: updatedLunchSource });
  } else {
    const dinnerSource = readUtf8(DINNER_MENU_SOURCE_FILE);
    const updatedDinnerSource = replaceMenuSlotValue({
      source: dinnerSource,
      weekKey: String(patch.week),
      dayKey: patch.day,
      slotKey: patch.dishSlotKey,
      newTitle: patch.recipeData.title,
    });
    if (updatedDinnerSource !== dinnerSource) writes.push({ filePath: DINNER_MENU_SOURCE_FILE, content: updatedDinnerSource });

    const overridesSource = readUtf8(DINNER_MENU_OVERRIDES_FILE);
    const updatedOverrides = updateDinnerOverrideIfPresent(
      overridesSource,
      patch.week,
      patch.day,
      patch.dishSlotKey,
      patch.recipeData.title
    );
    if (updatedOverrides !== overridesSource) writes.push({ filePath: DINNER_MENU_OVERRIDES_FILE, content: updatedOverrides });
  }

  writes.forEach(({ filePath, content }) => writeUtf8(filePath, content));
  rebuildIngredientIndex();
  runGlobalValidator();

  console.log(`Applied patch: ${patch.menu} week ${patch.week} ${patch.day} ${patch.dishSlotKey}`);
  console.log(`Matched existing title: ${oldKey || '(none)'}`);
  console.log(`Appended/updated title: ${patch.recipeData.title}`);
  console.log(`Updated recipe file: ${path.relative(ROOT_DIR, RECIPES_JSON_PATH)}`);
  console.log('Done. Next: git add/commit/push and hard refresh site.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
