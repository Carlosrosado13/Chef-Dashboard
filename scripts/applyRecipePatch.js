#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ROOT_DIR,
  DINNER_RECIPES_JSON_PATH,
  LUNCH_RECIPES_JSON_PATH,
  readRecipesJson,
  readMenuJson,
  writeMenuJson,
  readIngredientsJson,
  writeIngredientsJson,
  buildDinnerIngredientMenu,
} = require('./dataStore');
const { validateRecipePatchData, validateRecipeDataset } = require('./recipeValidation');

function usageAndExit(message) {
  if (message) console.error(message);
  console.error('Usage: node scripts/applyRecipePatch.js path/to/patch.json');
  process.exit(1);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
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
  const explicitAmount = String(ingredient.amount || '').trim();
  const notes = String(ingredient.notes || '').trim();
  const amount = explicitAmount || [qty, unit].filter(Boolean).join(' ').trim();
  const line = amount ? `${amount} ${name}` : name;
  return notes ? `${line} (${notes})` : line;
}

function normalizeRecipeData(recipeData) {
  const validated = validateRecipePatchData(recipeData);

  return {
    title: validated.title,
    portion: validated.portion,
    yield: validated.yield,
    servings: validated.servings,
    sourceUrl: validated.sourceUrl,
    generatedHtml: validated.generatedHtml,
    structuredIngredients: validated.ingredients,
    ingredients: validated.ingredients.map(ingredientToLine).map((line) => line.trim()).filter(Boolean),
    steps: validated.steps,
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
  const portionOrYield = recipeData.portion || recipeData.yield || recipeData.servings;
  const label = recipeData.portion ? 'Portion' : 'Yield';
  const yieldRow = portionOrYield ? `<p><strong>${label}:</strong> ${escapeHtml(portionOrYield)}</p>` : '';
  const structuredIngredients = Array.isArray(recipeData.structuredIngredients) ? recipeData.structuredIngredients : [];
  const ingredientRows = structuredIngredients
    .map((ingredient) => {
      const amount = escapeHtml(String(ingredient.amount || '').trim());
      const name = escapeHtml(String(ingredient.name || '').trim());
      return `<tr><td>${name}</td><td>${amount}</td><td>${amount}</td><td>${amount}</td></tr>`;
    })
    .join('');
  const stepRows = recipeData.steps
    .map((step) => `<li><p>${escapeHtml(step)}</p></li>`)
    .join('');

  return `<h2>${title}</h2>${yieldRow}<h3>Ingredients</h3><table><thead><tr><th>Ingredient</th><th>50</th><th>100</th><th>150</th></tr></thead><tbody>${ingredientRows}</tbody></table><h3>Method</h3><ol type="1">${stepRows}</ol>`;
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

function validateUpdatedRecipeData(menuRecipes, menu, week, key) {
  validateRecipeDataset(`${menu} recipes`, menuRecipes);
  const weekData = menuRecipes[String(week)] || menuRecipes[week];
  if (!Object.prototype.hasOwnProperty.call(weekData, key)) throw new Error(`${menu} recipes JSON updated key "${key}" missing after patch.`);
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
  const result = spawnSync(process.execPath, [generatorPath, '--json-only'], { cwd: ROOT_DIR, encoding: 'utf8' });
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
  const recipes = readRecipesJson();
  const menuData = readMenuJson();
  const ingredientsData = readIngredientsJson();
  const menuRecipes = recipes[patch.menu] && typeof recipes[patch.menu] === 'object' && !Array.isArray(recipes[patch.menu])
    ? recipes[patch.menu]
    : {};
  const weekKey = String(patch.week);
  const weekRecipes = menuRecipes[weekKey] && typeof menuRecipes[weekKey] === 'object' && !Array.isArray(menuRecipes[weekKey])
    ? menuRecipes[weekKey]
    : (menuRecipes[weekKey] = {});

  const oldKeyCandidates = [patch.oldRecipeKey, patch.oldDishName, patch.recipeData.title].filter(Boolean);
  const oldKey = resolveExistingRecipeKey(weekRecipes, oldKeyCandidates);
  weekRecipes[patch.recipeData.title] = buildRecipeHtml(patch.recipeData);
  validateUpdatedRecipeData(menuRecipes, patch.menu, patch.week, patch.recipeData.title);

  const recipeJsonPath = patch.menu === 'lunch' ? LUNCH_RECIPES_JSON_PATH : DINNER_RECIPES_JSON_PATH;
  const menuBranch = patch.menu === 'lunch' ? menuData.lunch : menuData.dinner;
  const weekMenuKey = patch.menu === 'lunch' ? `Week ${patch.week}` : String(patch.week);
  const weekMenu = menuBranch && menuBranch[weekMenuKey];
  if (!weekMenu || typeof weekMenu !== 'object') {
    throw new Error(`Menu week not found: ${patch.menu} ${weekMenuKey}`);
  }

  const dayMenu = weekMenu[patch.day];
  if (!dayMenu || typeof dayMenu !== 'object') {
    throw new Error(`Menu day not found: ${patch.day}`);
  }

  if (!Object.prototype.hasOwnProperty.call(dayMenu, patch.dishSlotKey)) {
    throw new Error(`Menu slot not found: ${patch.dishSlotKey}`);
  }

  dayMenu[patch.dishSlotKey] = patch.recipeData.title;

  const nextIngredientsData = {
    ...ingredientsData,
    menu: buildDinnerIngredientMenu(menuData.dinner || {}, recipes.dinner || {}, ingredientsData.menu),
  };

  writeMenuJson(menuData);
  fs.writeFileSync(recipeJsonPath, `${JSON.stringify(menuRecipes, null, 2)}\n`, 'utf8');
  writeIngredientsJson(nextIngredientsData);
  rebuildIngredientIndex();
  runGlobalValidator();

  console.log(`Applied patch: ${patch.menu} week ${patch.week} ${patch.day} ${patch.dishSlotKey}`);
  console.log(`Matched existing title: ${oldKey || '(none)'}`);
  console.log(`Appended/updated title: ${patch.recipeData.title}`);
  console.log(`Updated recipe file: ${path.relative(ROOT_DIR, recipeJsonPath)}`);
  console.log('Done. Updated centralized JSON data files only.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
