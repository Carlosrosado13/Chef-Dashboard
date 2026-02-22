#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const RECIPES_DINNER_FILE = path.join(ROOT_DIR, 'recipes.js');
const RECIPES_LUNCH_FILE = path.join(ROOT_DIR, 'recipeslunch.js');
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

function encodeTemplateLiteral(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/\r?\n/g, '');
}

function encodeSingleQuotedJsString(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function parseJsStringOrTemplate(source, index) {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i += 1;

  const quote = source[i];
  if (!quote || !['"', "'", '`'].includes(quote)) {
    return null;
  }

  const start = i;
  i += 1;

  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (quote === '`' && ch === '$' && source[i + 1] === '{') {
      i += 2;
      let depth = 1;
      while (i < source.length && depth > 0) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') depth -= 1;
        else if (source[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (ch === quote) {
      return { start, end: i + 1 };
    }
    i += 1;
  }

  return null;
}

function findMatchingBrace(source, openIndex) {
  if (openIndex < 0 || source[openIndex] !== '{') return -1;

  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    if (depth === 0) return i;
  }
  return -1;
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

function validatePatch(patch) {
  if (!patch || typeof patch !== 'object') {
    throw new Error('Patch must be a JSON object');
  }

  const menu = String(patch.menu || '').toLowerCase();
  if (!['lunch', 'dinner'].includes(menu)) {
    throw new Error('patch.menu must be lunch or dinner');
  }

  const week = Number(patch.week);
  if (!Number.isInteger(week) || week < 1 || week > 4) {
    throw new Error('patch.week must be an integer 1-4');
  }

  const day = normalizeDay(patch.day);
  if (!day) {
    throw new Error('patch.day is required');
  }

  const dishSlotId = String(patch.dishSlotId || '').trim();
  const dishSlotKey = String(patch.dishSlotKey || '').trim();
  if (!dishSlotId || !dishSlotKey) {
    throw new Error('patch.dishSlotId and patch.dishSlotKey are required');
  }

  const recipeData = patch.recipeData;
  if (!recipeData || typeof recipeData !== 'object') {
    throw new Error('patch.recipeData is required');
  }

  const title = String(recipeData.title || '').trim();
  if (!title) {
    throw new Error('patch.recipeData.title is required');
  }

  const normalizedRecipeData = normalizeRecipeData(recipeData);

  return {
    menu,
    week,
    day,
    dishSlotId,
    dishSlotKey,
    oldDishName: String(patch.oldDishName || '').trim(),
    oldRecipeKey: String(patch.oldRecipeKey || '').trim(),
    recipeData: normalizedRecipeData,
  };
}

function ingredientToLine(ingredient) {
  if (typeof ingredient === 'string') return ingredient.trim();
  if (!ingredient || typeof ingredient !== 'object') return '';

  const original = String(ingredient.original || '').trim();
  if (original) return original;

  const name = String(ingredient.name || '').trim();
  const qty = ingredient.qty == null ? '' : String(ingredient.qty).trim();
  const unit = String(ingredient.unit || '').trim();
  const notes = String(ingredient.notes || '').trim();

  if (!name) return '';
  const amount = [qty, unit].filter(Boolean).join(' ').trim();
  const base = amount ? `${amount} ${name}` : name;
  return notes ? `${base} (${notes})` : base;
}

function normalizeRecipeData(recipeData) {
  const title = String(recipeData.title || '').trim();
  const ingredientsRaw = Array.isArray(recipeData.ingredients) ? recipeData.ingredients : [];
  const stepsRaw = Array.isArray(recipeData.steps) ? recipeData.steps : [];
  const ingredients = ingredientsRaw.map(ingredientToLine).map((line) => line.trim()).filter(Boolean);
  const steps = stepsRaw.map((step) => String(step || '').trim()).filter(Boolean);
  const sourceUrl = String(recipeData.sourceUrl || '').trim();
  const generatedHtml = String(recipeData.generatedHtml || '').trim();

  return {
    title,
    ingredients,
    steps,
    sourceUrl,
    generatedHtml,
  };
}

function buildRecipeHtml(recipeData) {
  if (recipeData.generatedHtml && String(recipeData.generatedHtml).trim()) {
    return String(recipeData.generatedHtml).trim();
  }

  const title = escapeHtml(recipeData.title);
  const ingredients = recipeData.ingredients || [];
  const steps = recipeData.steps || [];

  const ingredientRows = ingredients.map((line) => {
    const name = String(line || '').trim();
    if (!name) return '';
    return `<tr><td>${escapeHtml(name)}</td><td></td></tr>`;
  }).filter(Boolean).join('');

  const stepRows = steps.map((step) => `<li><p>${escapeHtml(String(step))}</p></li>`).join('');

  return `<h2>${title}</h2><h3>Ingredients</h3><table><thead><tr><th>Ingredient</th><th>Amount</th></tr></thead><tbody>${ingredientRows}</tbody></table><h3>Method</h3><ol type="1">${stepRows}</ol>`;
}

function replaceRecipeEntryInFile({ source, week, oldKey, newKey, replacementHtml, menu }) {
  const weekPattern = new RegExp(`(?:'${week}'|"${week}"|${week})\\s*:\\s*\\{`, 'm');
  const weekMatch = weekPattern.exec(source);
  if (!weekMatch) {
    throw new Error(`Week ${week} not found in recipe file`);
  }

  const weekStart = source.indexOf('{', weekMatch.index);
  const weekEnd = findMatchingBrace(source, weekStart);
  if (weekStart === -1 || weekEnd === -1) {
    throw new Error(`Could not parse week block for week ${week}`);
  }

  const weekBlock = source.slice(weekStart, weekEnd + 1);
  const keyPattern = new RegExp(`(['"])${escapeRegExp(oldKey)}\\1\\s*:\\s*`, 'm');
  const keyMatch = keyPattern.exec(weekBlock);
  if (!keyMatch) {
    throw new Error(`Recipe key not found in week ${week}: ${oldKey}`);
  }

  const keyQuote = keyMatch[1];
  const absKeyStart = weekStart + keyMatch.index;
  const absValueStart = absKeyStart + keyMatch[0].length;

  const parsed = parseJsValueLiteral(source, absValueStart);
  if (!parsed) {
    throw new Error(`Unable to parse existing recipe value for key ${oldKey}`);
  }

  const replacementEntry = `${keyQuote}${newKey}${keyQuote}: ${replacementHtml}`;

  const updated = `${source.slice(0, absKeyStart)}${replacementEntry}${source.slice(parsed.end)}`;
  return updated;
}

function replaceMenuSlotValue({ source, weekKey, dayKey, slotKey, newTitle }) {
  const pattern = new RegExp(
    `("${escapeRegExp(weekKey)}"\\s*:\\s*\\{[\\s\\S]*?"${escapeRegExp(dayKey)}"\\s*:\\s*\\{[\\s\\S]*?"${escapeRegExp(slotKey)}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`
  );

  if (!pattern.test(source)) {
    throw new Error(`Could not find menu slot: week=${weekKey}, day=${dayKey}, slot=${slotKey}`);
  }

  return source.replace(pattern, `$1"${newTitle.replace(/"/g, '\\"')}"`);
}

function updateDinnerOverrideIfPresent(source, week, day, slotKey, newTitle) {
  const singleQuoted = newTitle.replace(/'/g, "\\'");

  const slotPatternBracket = new RegExp(
    `(dinnerMenuData\\['${escapeRegExp(String(week))}'\\]\\.${escapeRegExp(day)}\\['${escapeRegExp(slotKey)}'\\]\\s*=\\s*)'(?:[^'\\\\]|\\\\.)*'`
  );

  if (slotPatternBracket.test(source)) {
    return source.replace(slotPatternBracket, `$1'${singleQuoted}'`);
  }

  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(slotKey)) {
    const dotPattern = new RegExp(
      `(dinnerMenuData\\['${escapeRegExp(String(week))}'\\]\\.${escapeRegExp(day)}\\.${escapeRegExp(slotKey)}\\s*=\\s*)'(?:[^'\\\\]|\\\\.)*'`
    );
    if (dotPattern.test(source)) {
      return source.replace(dotPattern, `$1'${singleQuoted}'`);
    }
  }

  return source;
}

function parseJsValueLiteral(source, index) {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i += 1;

  const ch = source[i];
  if (!ch) return null;

  if (['"', "'", '`'].includes(ch)) {
    return parseJsStringOrTemplate(source, i);
  }

  if (ch === '{') {
    const end = findMatchingBrace(source, i);
    if (end === -1) return null;
    return { start: i, end: end + 1 };
  }

  return null;
}

function loadInSandbox(source, filename) {
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  const sandbox = vm.createContext(runtime);
  vm.runInContext(source, sandbox, { filename });
  return sandbox;
}

function hasWeekLikeRecipeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;

  const weekKeys = Object.keys(data).filter((key) => Number.isFinite(Number(String(key).replace(/[^\d]/g, ''))));
  if (!weekKeys.length) return false;

  return weekKeys.every((weekKey) => {
    const weekRecipes = data[weekKey];
    if (!weekRecipes || typeof weekRecipes !== 'object' || Array.isArray(weekRecipes)) {
      return false;
    }
    const recipeKeys = Object.keys(weekRecipes);
    if (!recipeKeys.length) return false;
    return recipeKeys.some((recipeKey) => {
      const value = weekRecipes[recipeKey];
      if (typeof value === 'string') return true;
      return Boolean(value && typeof value === 'object');
    });
  });
}

function validateUpdatedRecipeSource(menu, source) {
  const filename = menu === 'lunch' ? 'recipeslunch.js' : 'recipes.js';
  const sandbox = loadInSandbox(source, filename);
  const recipeData = menu === 'lunch'
    ? ((sandbox.module && sandbox.module.exports && sandbox.module.exports.recipesLunchData) || sandbox.recipesLunchData)
    : sandbox.recipesData;

  if (!recipeData) {
    throw new Error(`${filename} missing expected recipe global after patch.`);
  }
  if (!hasWeekLikeRecipeData(recipeData)) {
    throw new Error(`${filename} has invalid structure after patch.`);
  }
}

function normalizeRecipeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveExistingRecipeKey({ source, menu, week, candidates }) {
  const filename = menu === 'lunch' ? 'recipeslunch.js' : 'recipes.js';
  const sandbox = loadInSandbox(source, filename);
  const recipeData = menu === 'lunch'
    ? ((sandbox.module && sandbox.module.exports && sandbox.module.exports.recipesLunchData) || sandbox.recipesLunchData)
    : sandbox.recipesData;

  const weekData = recipeData && (recipeData[String(week)] || recipeData[week]);
  if (!weekData || typeof weekData !== 'object') return '';

  const keys = Object.keys(weekData);
  if (!keys.length) return '';

  const normalizedCandidates = candidates
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const candidate of normalizedCandidates) {
    const exact = keys.find((key) => key === candidate);
    if (exact) return exact;
  }

  const normalizedKeyMap = keys.map((key) => ({ key, norm: normalizeRecipeKey(key) }));
  for (const candidate of normalizedCandidates) {
    const normCandidate = normalizeRecipeKey(candidate);
    const exactNorm = normalizedKeyMap.find((entry) => entry.norm === normCandidate);
    if (exactNorm) return exactNorm.key;
  }

  for (const candidate of normalizedCandidates) {
    const normCandidate = normalizeRecipeKey(candidate);
    const fuzzy = normalizedKeyMap.find((entry) => entry.norm.includes(normCandidate) || normCandidate.includes(entry.norm));
    if (fuzzy) return fuzzy.key;
  }

  return '';
}

function main() {
  const patchFile = process.argv[2];
  if (!patchFile) {
    usageAndExit();
  }

  const patchPath = path.resolve(process.cwd(), patchFile);
  if (!fs.existsSync(patchPath)) {
    usageAndExit(`Patch file not found: ${patchPath}`);
  }

  const patchRaw = readUtf8(patchPath);
  let patchJson;
  try {
    patchJson = JSON.parse(patchRaw);
  } catch (error) {
    usageAndExit(`Invalid patch JSON: ${error.message}`);
  }

  const patch = validatePatch(patchJson);

  const newTitle = patch.recipeData.title;
  const candidateOldTitles = [patch.oldRecipeKey, patch.oldDishName, patch.recipeData.title].filter(Boolean);
  if (!candidateOldTitles.length) {
    throw new Error('Patch must include oldRecipeKey or oldDishName to identify existing entry');
  }

  const generatedHtml = buildRecipeHtml(patch.recipeData);
  const replacementEntry = {
    title: patch.recipeData.title,
    ingredients: patch.recipeData.ingredients,
    steps: patch.recipeData.steps,
    sourceUrl: patch.recipeData.sourceUrl,
    generatedHtml,
  };
  const replacementLiteral = JSON.stringify(replacementEntry, null, 2);

  const recipeFile = patch.menu === 'lunch' ? RECIPES_LUNCH_FILE : RECIPES_DINNER_FILE;
  const recipeSource = readUtf8(recipeFile);
  const oldTitle = resolveExistingRecipeKey({
    source: recipeSource,
    menu: patch.menu,
    week: patch.week,
    candidates: candidateOldTitles,
  });
  if (!oldTitle) {
    throw new Error(`Recipe key not found in week ${patch.week} for any candidate: ${candidateOldTitles.join(' | ')}`);
  }
  const updatedRecipeSource = replaceRecipeEntryInFile({
    source: recipeSource,
    week: patch.week,
    oldKey: oldTitle,
    newKey: newTitle,
    replacementHtml: replacementLiteral,
    menu: patch.menu,
  });

  if (updatedRecipeSource === recipeSource) {
    throw new Error('Recipe file did not change; aborting.');
  }

  validateUpdatedRecipeSource(patch.menu, updatedRecipeSource);

  const pendingWrites = [{ filePath: recipeFile, content: updatedRecipeSource }];

  if (patch.menu === 'lunch') {
    const lunchSource = readUtf8(LUNCH_MENU_SOURCE_FILE);
    const updatedLunchSource = replaceMenuSlotValue({
      source: lunchSource,
      weekKey: `Week ${patch.week}`,
      dayKey: patch.day,
      slotKey: patch.dishSlotKey,
      newTitle,
    });

    if (updatedLunchSource !== lunchSource) {
      pendingWrites.push({ filePath: LUNCH_MENU_SOURCE_FILE, content: updatedLunchSource });
    }
  } else {
    const dinnerSource = readUtf8(DINNER_MENU_SOURCE_FILE);
    const updatedDinnerSource = replaceMenuSlotValue({
      source: dinnerSource,
      weekKey: String(patch.week),
      dayKey: patch.day,
      slotKey: patch.dishSlotKey,
      newTitle,
    });

    if (updatedDinnerSource !== dinnerSource) {
      pendingWrites.push({ filePath: DINNER_MENU_SOURCE_FILE, content: updatedDinnerSource });
    }

    const dinnerOverridesSource = readUtf8(DINNER_MENU_OVERRIDES_FILE);
    const updatedOverridesSource = updateDinnerOverrideIfPresent(
      dinnerOverridesSource,
      patch.week,
      patch.day,
      patch.dishSlotKey,
      newTitle
    );

    if (updatedOverridesSource !== dinnerOverridesSource) {
      pendingWrites.push({ filePath: DINNER_MENU_OVERRIDES_FILE, content: updatedOverridesSource });
    }
  }

  pendingWrites.forEach(({ filePath, content }) => writeUtf8(filePath, content));

  console.log(`Applied patch: ${patch.menu} week ${patch.week} ${patch.day} ${patch.dishSlotKey}`);
  console.log(`Changed title: ${oldTitle} -> ${newTitle}`);
  console.log(`Updated recipe file: ${path.relative(ROOT_DIR, recipeFile)}`);
  console.log('Done. Next: git add/commit/push and hard refresh site.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
