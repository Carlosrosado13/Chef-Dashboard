// Chef Dashboard Script

const dinnerCategoryConfig = [
  { key: 'Appetizer 1', label: 'Appetizer 1' },
  { key: 'Appetizer 2', label: 'Appetizer 2' },
  { key: 'Elevated', label: 'Elevated' },
  { key: 'Traditional', label: 'Traditional' },
  { key: 'Alternative', label: 'Alternative' },
  { key: 'Veg 1', label: 'Veg 1' },
  { key: 'Veg 2', label: 'Veg 2' },
  { key: 'Starch', label: 'Starch' },
  { key: 'Dessert', label: 'Dessert' }
];

const lunchCategoryConfig = [
  { key: 'SOUP', label: 'Soup' },
  { key: 'MAIN 1', label: 'Main 1' },
  { key: 'MAIN 2', label: 'Main 2' },
  { key: 'SALAD', label: 'Side (Salad)' },
  { key: 'DESSERT', label: 'Dessert' }
];

const bootErrors = [];

function safeParse(jsonText, fallback = null) {
  if (typeof jsonText !== 'string') return fallback;
  const trimmed = jsonText.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return fallback;
  }
}

function asString(value) {
  return typeof value === 'string' ? value : '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeIndexOf(value, needle) {
  if (typeof value === 'string' || Array.isArray(value)) return value.indexOf(needle);
  return -1;
}

function safeLength(value) {
  if (typeof value === 'string' || Array.isArray(value)) return value.length;
  return 0;
}

function safeObjectKeys(value) {
  if (!value || typeof value !== 'object') return [];
  try {
    return Object.keys(value);
  } catch (_error) {
    return [];
  }
}

function readStorageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function writeStorageItem(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (_error) {
    return false;
  }
}

function removeStorageItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (_error) {
    // Ignore storage failures in locked-down browser contexts.
  }
}

function reportBootError(message) {
  const text = String(message || 'Unknown startup error');
  if (!bootErrors.includes(text)) bootErrors.push(text);
  console.error(text);
}

function resolveGlobalValue(...names) {
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    if (Object.prototype.hasOwnProperty.call(globalThis, name) && globalThis[name]) {
      return globalThis[name];
    }
  }

  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    if (name === 'menuData' && typeof menuData !== 'undefined') return menuData;
    if (name === 'dinnerMenuData' && typeof dinnerMenuData !== 'undefined') return dinnerMenuData;
    if (name === 'menuOverviewData' && typeof menuOverviewData !== 'undefined') return menuOverviewData;
    if (name === 'lunchMenuData' && typeof lunchMenuData !== 'undefined') return lunchMenuData;
    if (name === 'recipesData' && typeof recipesData !== 'undefined') return recipesData;
    if (name === 'recipesLunchData' && typeof recipesLunchData !== 'undefined') return recipesLunchData;
  }

  return undefined;
}

function hasWeekLikeRecipeData(data) {
  if (!data || typeof data !== 'object') return false;
  const keys = Object.keys(data);
  if (!keys.length) return false;

  const weekKeys = keys.filter(key => Number.isFinite(Number(String(key).replace(/[^\d]/g, ''))));
  if (!weekKeys.length) return false;

  const sampleWeek = data[weekKeys[0]];
  if (!sampleWeek || typeof sampleWeek !== 'object') return false;

  return Object.values(sampleWeek).some(value => typeof value === 'string');
}

function validateRecipeData(label, data) {
  if (!hasWeekLikeRecipeData(data)) {
    reportBootError(`Recipe data failed to load. Check frontend/data/recipes.json (${label}).`);
    return null;
  }
  return data;
}

function validateMenuData(label, data) {
  if (!data || typeof data !== 'object' || !Object.keys(data).length) {
    reportBootError(`Menu data failed to load (${label}).`);
    return {};
  }
  return data;
}

const ingredientDataStore = resolveGlobalValue('menuData') || { menu: [] };
const dinnerMenuDataStore = validateMenuData('Dinner Menu', resolveGlobalValue('dinnerMenuData', 'menuOverviewData') || {});
const lunchMenuDataStore = validateMenuData('Lunch Menu', resolveGlobalValue('lunchMenuData') || {});
const mealData = {
  dinner: dinnerMenuDataStore,
  lunch: lunchMenuDataStore
};
const RECIPES_JSON_PATH = 'frontend/data/recipes.json';
let recipesStore = null;
let lunchRecipesStore = {};

let selectedDish = null;
let selectedMeal = 'dinner';
let extractedRecipeDraft = null;
let generatedRecipeHtmlDraft = '';

const ingredientCategories = ['produce', 'protein', 'dairy', 'dry', 'other'];
const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EXPORT_BASE_PATH = 'data/exports';
const REPORT_BASE_PATH = 'data/reports';
const API_BASE_STORAGE_KEY = 'chefDashboardApiBaseUrl';
const RECIPE_OVERRIDES_STORAGE_KEY = 'chefDashboardRecipeOverridesV1';
const LEGACY_RECIPE_OVERRIDES_STORAGE_KEY = 'chefDashboardRecipeOverrides';
const DEFAULT_API_BASE_URL = 'https://chef-dashboard-update-recipes.carlosrosado13.workers.dev';
const WEEKLY_DAY_KEYS = {
  Monday: ['Monday', 'Mon'],
  Tuesday: ['Tuesday', 'Tue', 'Tues'],
  Wednesday: ['Wednesday', 'Wed'],
  Thursday: ['Thursday', 'Thu', 'Thur', 'Thurs'],
  Friday: ['Friday', 'Fri'],
  Saturday: ['Saturday', 'Sat'],
  Sunday: ['Sunday', 'Sun']
};

async function loadRecipeStores() {
  try {
    const response = await fetch(RECIPES_JSON_PATH, { cache: 'no-store' });
    if (!response.ok) {
      reportBootError(`Recipe data request failed (${response.status})`);
      return false;
    }

    const payload = await response.json();
    const dinnerRecipes = validateRecipeData('Dinner Recipes', asObject(payload && payload.dinner));
    const lunchRecipes = validateRecipeData('Lunch Recipes', asObject(payload && payload.lunch)) || {};

    recipesStore = dinnerRecipes;
    lunchRecipesStore = lunchRecipes;
    globalThis.recipesData = dinnerRecipes;
    globalThis.recipesLunchData = lunchRecipes;
    if (typeof window !== 'undefined') {
      window.recipesData = dinnerRecipes;
      window.recipesLunchData = lunchRecipes;
    }
    return true;
  } catch (error) {
    reportBootError(`Recipe data request failed: ${error.message || error}`);
    recipesStore = null;
    lunchRecipesStore = {};
    return false;
  }
}

function normalizeToken(value) {
  return String(value == null ? '' : value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeMenuName(value) {
  return normalizeToken(value) === 'lunch' ? 'lunch' : 'dinner';
}

function normalizeWeekValue(value) {
  const cleaned = String(value == null ? '' : value).replace(/[^\d]/g, '');
  if (!cleaned) return '';
  const weekNumber = Number(cleaned);
  return Number.isFinite(weekNumber) && weekNumber > 0 ? String(weekNumber) : '';
}

function normalizeDayName(dayValue) {
  const target = normalizeToken(dayValue);
  if (!target) return '';
  for (let i = 0; i < dayOrder.length; i += 1) {
    const day = dayOrder[i];
    const aliases = asArray(WEEKLY_DAY_KEYS[day]).concat(day);
    if (aliases.some((alias) => normalizeToken(alias) === target)) return day;
  }
  return '';
}

function findMatchingKey(sourceObject, rawKey) {
  if (!sourceObject || typeof sourceObject !== 'object') return '';
  const normalizedTarget = normalizeToken(rawKey);
  if (!normalizedTarget) return '';
  const keys = safeObjectKeys(sourceObject);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (normalizeToken(key) === normalizedTarget) return key;
  }
  return '';
}

function normalizeStorageApiBase(rawValue) {
  const rawString = asString(rawValue).trim();
  if (!rawString) return '';
  if (safeIndexOf(rawString, '[object Object]') === 0) return '';
  const parsed = safeParse(rawString, null);
  if (parsed == null) return '';
  if (typeof parsed === 'string') return parsed.trim().replace(/\/+$/, '');
  return rawString.replace(/\/+$/, '');
}

function normalizeRecipeOverrideEntry(entry) {
  const source = asObject(entry);
  const menu = normalizeMenuName(source.menu);
  const week = normalizeWeekValue(source.week);
  const day = normalizeDayName(source.day);
  const dishSlotKey = asString(source.dishSlotKey || source.dishSlot || source.slot).trim().replace(/\s+/g, ' ');
  const oldRecipeKey = asString(source.oldRecipeKey).trim();
  const oldDishName = asString(source.oldDishName).trim();
  const dishName = asString(source.dishName || source.newDishName).trim();
  const recipeKey = asString(source.recipeKey).trim();
  const generatedHtml = asString(source.generatedHtml);
  const recipeData = normalizeExtractedRecipe(source.recipeData);
  if (!week || !day || !dishSlotKey) return null;

  return {
    menu,
    week,
    day,
    dishSlotKey,
    oldRecipeKey,
    oldDishName,
    dishName,
    recipeKey,
    generatedHtml,
    recipeData,
  };
}

function parseRecipeOverrides(rawValue) {
  const parsed = safeParse(asString(rawValue), []);
  const list = asArray(parsed);
  return list
    .map(normalizeRecipeOverrideEntry)
    .filter(Boolean);
}

function loadRecipeOverridesFromStorage() {
  const rawCurrent = readStorageItem(RECIPE_OVERRIDES_STORAGE_KEY);
  const currentOverrides = parseRecipeOverrides(rawCurrent);
  if (safeLength(currentOverrides) > 0) return currentOverrides;

  const rawLegacy = readStorageItem(LEGACY_RECIPE_OVERRIDES_STORAGE_KEY);
  const legacyOverrides = parseRecipeOverrides(rawLegacy);
  if (safeLength(legacyOverrides) > 0) {
    writeStorageItem(RECIPE_OVERRIDES_STORAGE_KEY, JSON.stringify(legacyOverrides));
    removeStorageItem(LEGACY_RECIPE_OVERRIDES_STORAGE_KEY);
  }
  return legacyOverrides;
}

function cleanUpStorage() {
  const apiRaw = readStorageItem(API_BASE_STORAGE_KEY);
  if (apiRaw != null) {
    const normalizedApiBase = normalizeStorageApiBase(apiRaw);
    if (normalizedApiBase) {
      writeStorageItem(API_BASE_STORAGE_KEY, normalizedApiBase);
    } else {
      removeStorageItem(API_BASE_STORAGE_KEY);
    }
  }

  const rawCurrent = readStorageItem(RECIPE_OVERRIDES_STORAGE_KEY);
  const currentOverrides = parseRecipeOverrides(rawCurrent);
  if (rawCurrent != null) {
    if (safeLength(currentOverrides) > 0) {
      writeStorageItem(RECIPE_OVERRIDES_STORAGE_KEY, JSON.stringify(currentOverrides));
    } else {
      removeStorageItem(RECIPE_OVERRIDES_STORAGE_KEY);
    }
  }

  const rawLegacy = readStorageItem(LEGACY_RECIPE_OVERRIDES_STORAGE_KEY);
  if (rawLegacy != null) {
    const migrated = parseRecipeOverrides(rawLegacy);
    if (safeLength(migrated) > 0) {
      writeStorageItem(RECIPE_OVERRIDES_STORAGE_KEY, JSON.stringify(migrated));
    }
    removeStorageItem(LEGACY_RECIPE_OVERRIDES_STORAGE_KEY);
  }
}

function asIngredientLine(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (typeof value === 'object') {
    if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
    if (typeof value.original === 'string' && value.original.trim()) return value.original.trim();
    if (typeof value.raw === 'string' && value.raw.trim()) return value.raw.trim();
    if (typeof value.text === 'string' && value.text.trim()) return value.text.trim();
  }
  return '';
}

function ingredientToDisplay(ing) {
  if (typeof ing === 'string') return { name: ing.trim(), amount: '' };
  if (!ing || typeof ing !== 'object') return { name: '', amount: '' };
  const original = (ing.original || '').trim();
  const name = (ing.name || '').trim();
  const qty = ing.qty ?? '';
  const unit = (ing.unit || '').trim();
  const notes = (ing.notes || '').trim();
  const amount = [qty, unit].filter(Boolean).join(' ').trim();
  if (name) return { name: notes ? `${name} (${notes})` : name, amount };
  if (original) return { name: original, amount: '' };
  return { name: '', amount: '' };
}

function normalizeName(name) {
  if (!name) return '';
  let cleaned = asIngredientLine(name).replace(/\([^)]*\)/g, '');
  cleaned = cleaned.replace(/[-,]/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, 'and');
  cleaned = cleaned.replace(/\bwith\b/gi, ' ');
  cleaned = cleaned.replace(/\band\b/gi, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.toLowerCase();
}

function stringifyIngredientValue(value) {
  return asIngredientLine(value);
}

function normalizeIngredientItem(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const fallback = asIngredientLine(value);
    return {
      name: stringifyIngredientValue(value.name) || fallback,
      qty: value.qty == null ? null : value.qty,
      unit: value.unit == null ? '' : String(value.unit),
      notes: value.notes == null ? '' : String(value.notes),
    };
  }

  return {
    name: stringifyIngredientValue(value),
    qty: null,
    unit: '',
    notes: '',
  };
}

function normalizeExtractedRecipe(recipeJson) {
  const source = recipeJson && typeof recipeJson === 'object' ? recipeJson : {};
  const ingredientsRaw = Array.isArray(source.ingredients) ? source.ingredients : [];
  const stepsRaw = Array.isArray(source.steps) ? source.steps : [];

  return {
    ...source,
    title: source.title == null ? '' : String(source.title),
    servings: source.servings == null ? (source.yield == null ? '' : String(source.yield)) : String(source.servings),
    ingredients: ingredientsRaw
      .map(normalizeIngredientItem)
      .filter((item) => item && asIngredientLine(item.name)),
    steps: stepsRaw.map((step) => String(step == null ? '' : step)),
    sourceUrl: source.sourceUrl == null ? '' : String(source.sourceUrl),
  };
}

function stripHtml(value) {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseQuantityAndUnit(value) {
  const cleaned = stripHtml(asIngredientLine(value)).replace(/,/g, '.');
  if (!cleaned) return { quantity: null, unit: '' };
  if (/to taste/i.test(cleaned)) return { quantity: null, unit: 'to taste' };

  const fractionMap = { '\u00BD': 0.5, '\u00BC': 0.25, '\u00BE': 0.75, '\u2153': 1 / 3, '\u2154': 2 / 3, '\u215B': 0.125 };
  const directFraction = cleaned.match(/^([\u00BD\u00BC\u00BE\u2153\u2154\u215B])(?:\s+(.*))?$/);
  if (directFraction) {
    return {
      quantity: fractionMap[directFraction[1]],
      unit: (directFraction[2] || '').trim()
    };
  }

  const numericMatch = cleaned.match(/^(\d+(?:\.\d+)?)(?:\s+([\w/%.-]+(?:\s+[\w/%.-]+)*))?$/i);
  if (numericMatch) {
    return {
      quantity: Number(numericMatch[1]),
      unit: (numericMatch[2] || '').trim()
    };
  }

  const mixedFraction = cleaned.match(/^(\d+)\s+([\u00BD\u00BC\u00BE\u2153\u2154\u215B])(?:\s+(.*))?$/);
  if (mixedFraction) {
    return {
      quantity: Number(mixedFraction[1]) + fractionMap[mixedFraction[2]],
      unit: (mixedFraction[3] || '').trim()
    };
  }

  return { quantity: null, unit: cleaned };
}

function parseIngredientsFromRecipeHtml(recipeHtml) {
  const rows = [];
  if (!recipeHtml || typeof recipeHtml !== 'string') return rows;
  const trMatches = recipeHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  trMatches.forEach(row => {
    const tdMatches = row.match(/<td[\s\S]*?<\/td>/gi) || [];
    if (tdMatches.length < 2) return;
    const ingredientName = asIngredientLine(stripHtml(tdMatches[0]));
    if (!ingredientName || /^ingredient$/i.test(ingredientName)) return;
    const amount = parseQuantityAndUnit(tdMatches[1]);
    rows.push({ name: ingredientName, quantity: amount.quantity, unit: amount.unit });
  });
  return rows;
}

function getRecipeHtmlForIngredientParsing(recipeValue) {
  if (typeof recipeValue === 'string') return recipeValue;
  if (recipeValue && typeof recipeValue === 'object') {
    if (typeof recipeValue.generatedHtml === 'string') return recipeValue.generatedHtml;
    if (typeof recipeValue.recipeHtml === 'string') return recipeValue.recipeHtml;
    return buildGeneratedRecipeHtml(recipeValue);
  }
  return '';
}

function buildCategoryLookup() {
  const lookup = {};
  const menuEntries = asArray(ingredientDataStore && ingredientDataStore.menu);
  menuEntries.forEach(entry => {
    if (!entry || !entry.categories) return;
    ingredientCategories.forEach(category => {
      const items = asArray(entry.categories[category]);
      items.forEach(item => {
        const key = normalizeName(stringifyIngredientValue(item && item.name != null ? item.name : item));
        if (key && !lookup[key]) lookup[key] = category;
      });
    });
  });
  return lookup;
}

function findRecipeKey(weekRecipes, dishName) {
  if (!weekRecipes || typeof weekRecipes !== 'object') return null;
  const target = normalizeName(dishName);
  let bestKey = null;
  let bestScore = 0;
  for (const recipeName in weekRecipes) {
    if (!Object.prototype.hasOwnProperty.call(weekRecipes, recipeName)) continue;
    const normKey = normalizeName(recipeName);
    if (normKey === target) return recipeName;
    const keyWords = normKey.split(' ').filter(Boolean);
    const targetWords = target.split(' ').filter(Boolean);
    if (!keyWords.length || !targetWords.length) continue;
    const common = targetWords.filter(word => keyWords.includes(word));
    const score = common.length / Math.min(keyWords.length, targetWords.length);
    if (score > bestScore) {
      bestScore = score;
      bestKey = recipeName;
    }
  }
  return bestScore >= 0.4 ? bestKey : null;
}

function buildIngredientCheckerData() {
  const dinnerOverview = dinnerMenuDataStore;
  if (!dinnerOverview || !recipesStore) {
    console.warn('Ingredient checker skipped: menu overview and/or recipes data are unavailable.');
    return;
  }
  const categoryLookup = buildCategoryLookup();
  const generatedMenu = [];

  safeObjectKeys(dinnerOverview).forEach(weekKey => {
    const weekNumber = Number(weekKey);
    const weekDays = asObject(dinnerOverview[weekKey]);
    safeObjectKeys(weekDays).forEach(day => {
      const categories = { produce: [], protein: [], dairy: [], dry: [], other: [] };
      const seenByCategory = { produce: new Set(), protein: new Set(), dairy: new Set(), dry: new Set(), other: new Set() };
      const dayMenu = asObject(weekDays[day]);
      const weekRecipes = asObject(recipesStore[weekKey]);

      safeObjectKeys(dayMenu).forEach(menuCategory => {
        const dishName = asString(dayMenu[menuCategory]);
        if (!dishName || /^(n\/a|add alternative)$/i.test(dishName.trim())) return;
        const recipeKey = findRecipeKey(weekRecipes, dishName);
        if (!recipeKey) return;

        try {
          const recipeValue = weekRecipes[recipeKey];
          parseIngredientsFromRecipeHtml(getRecipeHtmlForIngredientParsing(recipeValue)).forEach(ingredient => {
            const safeIngredient = normalizeIngredientItem(ingredient);
            if (!safeIngredient.name) {
              console.warn(`Invalid ingredient found in recipe "${recipeKey}" (week ${weekKey}, ${day})`);
              return;
            }
            const normalized = normalizeName(safeIngredient.name);
            if (!normalized) return;
            const category = categoryLookup[normalized] || 'other';
            if (seenByCategory[category].has(normalized)) return;
            seenByCategory[category].add(normalized);
            categories[category].push({
              name: safeIngredient.name,
              quantity: safeIngredient.qty,
              unit: safeIngredient.unit,
            });
          });
        } catch (error) {
          console.warn(`Skipping ingredient processing for recipe "${recipeKey}" due to invalid data:`, error);
        }
      });

      generatedMenu.push({ week: weekNumber, day, categories });
    });
  });

  ingredientDataStore.menu = generatedMenu;
  validateIngredientCheckerData();
}

function validateIngredientCheckerData() {
  const menuEntries = asArray(ingredientDataStore && ingredientDataStore.menu);
  const weeks = new Set(menuEntries.map(entry => entry && entry.week).filter((week) => week != null));
  let totalIngredients = 0;
  const emptyWeeks = [];

  weeks.forEach(week => {
    const weekEntries = menuEntries.filter(entry => entry && entry.week === week);
    const seen = new Set();
    let count = 0;
    weekEntries.forEach(entry => {
      ingredientCategories.forEach(category => {
        asArray(entry.categories && entry.categories[category]).forEach(item => {
          const ingredientName = stringifyIngredientValue(item && item.name != null ? item.name : item);
          const key = `${entry.day}|${category}|${normalizeName(ingredientName)}`;
          if (seen.has(key)) {
            console.warn(`Duplicate ingredient found in week ${week}: ${ingredientName} (${entry.day})`);
            return;
          }
          seen.add(key);
          count += 1;
        });
      });
    });
    if (count === 0) emptyWeeks.push(week);
    totalIngredients += count;
  });

  if (totalIngredients === 0) throw new Error('Ingredient checker has no ingredients loaded.');
  if (emptyWeeks.length > 0) {
    console.warn(`Ingredient checker has no generated ingredients for week(s): ${emptyWeeks.join(', ')}.`);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRecipe() {
  const recipeDetails = document.getElementById('recipeDetails');
  if (!recipeDetails) return;

  const weekSelect = document.getElementById('weekSelect');
  const week = weekSelect.value;
  const invalidDishPattern = selectedMeal === 'dinner'
    ? /^(add alternative|n\/a)$/i
    : /^menu item not set$/i;

  if (!selectedDish || invalidDishPattern.test(selectedDish)) {
    recipeDetails.innerHTML = '<p>Select a dish to view its recipe.</p>';
    return;
  }

  const store = selectedMeal === 'dinner' ? recipesStore : lunchRecipesStore;
  if (!store || typeof store !== 'object') {
    recipeDetails.innerHTML = '<p>Recipe data failed to load. Check frontend/data/recipes.json.</p>';
    return;
  }
  const weekRecipes = store && store[week];
  if (!weekRecipes) {
    recipeDetails.innerHTML = '<p>Recipe data not available for this week.</p>';
    return;
  }

  const bestKey = findRecipeKey(weekRecipes, selectedDish);
  if (bestKey) {
    const recipeValue = weekRecipes[bestKey];
    if (typeof recipeValue === 'string') {
      recipeDetails.innerHTML = sanitizeRecipeHtmlIngredients(recipeValue);
    } else if (recipeValue && typeof recipeValue === 'object') {
      recipeDetails.innerHTML = renderRecipeObject(recipeValue);
    } else {
      recipeDetails.innerHTML = '<p>Recipe not available for the selected dish.</p>';
    }
  } else {
    recipeDetails.innerHTML = '<p>Recipe not available for the selected dish.</p>';
  }
}

function hasNonEmptyIngredientRows(recipeHtml) {
  if (!recipeHtml || typeof recipeHtml !== 'string') return false;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = recipeHtml;
  const rows = Array.from(wrapper.querySelectorAll('table tbody tr'));
  return rows.some((row) => {
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => stripHtml(cell.textContent || '').trim());
    if (!cells.length) return false;
    if (cells.length === 1) return Boolean(cells[0]);
    return Boolean(cells[0] || cells[1] || cells.slice(2).some(Boolean));
  });
}

function renderRecipeObject(recipeValue) {
  const generatedHtml = typeof recipeValue.generatedHtml === 'string'
    ? recipeValue.generatedHtml
    : typeof recipeValue.recipeHtml === 'string'
      ? recipeValue.recipeHtml
      : '';

  if (generatedHtml && hasNonEmptyIngredientRows(generatedHtml)) {
    return sanitizeRecipeHtmlIngredients(generatedHtml);
  }

  return buildGeneratedRecipeHtml(recipeValue);
}

function sanitizeRecipeHtmlIngredients(recipeHtml) {
  if (!recipeHtml || typeof recipeHtml !== 'string') return '<p>No ingredients found for this recipe.</p>';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = recipeHtml;
  const table = wrapper.querySelector('table');
  if (!table) return recipeHtml;

  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const keptRows = rows.filter((row) => {
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => stripHtml(cell.textContent || '').trim());
    if (!cells.length) return false;
    if (cells.length === 1) return Boolean(cells[0]);
    return Boolean(cells[0] || cells[1] || cells.slice(2).some(Boolean));
  });

  rows.forEach((row) => {
    if (!keptRows.includes(row)) row.remove();
  });

  if (!keptRows.length) {
    const warning = document.createElement('p');
    warning.className = 'no-ingredients-warning';
    warning.textContent = 'No ingredients found for this recipe.';
    table.insertAdjacentElement('afterend', warning);
  }

  return wrapper.innerHTML;
}

function handleDishClick(elem) {
  const dishName = elem.dataset.dish;
  const invalidDishPattern = selectedMeal === 'dinner'
    ? /^(add alternative|n\/a)$/i
    : /^menu item not set$/i;
  if (!dishName || invalidDishPattern.test(dishName)) return;

  selectedDish = dishName;
  const blocks = document.querySelectorAll('.menu-item-block');
  Array.prototype.forEach.call(blocks, block => block.classList.remove('selected'));
  elem.classList.add('selected');
  renderRecipe();
}

function getSelectedMealData(meal) {
  const data = meal === 'dinner' ? dinnerMenuDataStore : lunchMenuDataStore;
  return data || {};
}

function getWeekDataForMeal(meal) {
  const data = meal ? getSelectedMealData(meal) : getSelectedMealData(selectedMeal);
  return data || {};
}

function normalizeWeekKey(weekKey) {
  return /^Week\s+\d+$/i.test(String(weekKey)) ? String(weekKey) : `Week ${weekKey}`;
}

function getWeekDataContainer(meal, weekKey) {
  const data = getSelectedMealData(meal);
  const numericWeekKey = String(weekKey).replace(/[^\d]/g, '');
  return data[normalizeWeekKey(weekKey)] || data[numericWeekKey] || data[String(weekKey)] || {};
}

function populateWeeks(meal) {
  const weekSelect = document.getElementById('weekSelect');
  const currentWeek = asString(weekSelect.value);
  weekSelect.innerHTML = '';

  const mealWeeks = getWeekDataForMeal(meal);
  safeObjectKeys(mealWeeks)
    .map(key => ({
      source: key,
      number: Number(String(key).replace(/[^\d]/g, ''))
    }))
    .filter(item => Number.isFinite(item.number) && item.number > 0)
    .sort((a, b) => a.number - b.number)
    .forEach(item => {
      const option = document.createElement('option');
      option.value = String(item.number);
      option.textContent = `Week ${item.number}`;
      weekSelect.appendChild(option);
    });

  if (currentWeek && Array.prototype.some.call(weekSelect.options, option => option.value === currentWeek)) {
    weekSelect.value = currentWeek;
  }
}

function populateDays() {
  const weekSelect = document.getElementById('weekSelect');
  const daySelect = document.getElementById('daySelect');
  daySelect.innerHTML = '';
  const week = asString(weekSelect.value);
  const weekData = getWeekDataContainer(selectedMeal, week);
  const days = dayOrder.filter(day => {
    const aliases = WEEKLY_DAY_KEYS[day] || [day];
    return aliases.some(alias => Object.prototype.hasOwnProperty.call(weekData, alias));
  });
  days.forEach(day => {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = day;
    daySelect.appendChild(option);
  });
}

function getMealMenu(meal, weekKey, dayName) {
  const weekData = getWeekDataContainer(meal, weekKey);
  if (!weekData) return {};

  const aliases = WEEKLY_DAY_KEYS[dayName] || [dayName];
  for (let i = 0; i < aliases.length; i += 1) {
    const alias = aliases[i];
    if (Object.prototype.hasOwnProperty.call(weekData, alias)) return weekData[alias] || {};
  }
  return {};
}

function getExistingDayAlias(weekData, dayName) {
  const aliases = asArray(WEEKLY_DAY_KEYS[dayName]).concat([dayName]);
  for (let i = 0; i < safeLength(aliases); i += 1) {
    const alias = aliases[i];
    if (Object.prototype.hasOwnProperty.call(weekData, alias)) return alias;
  }
  return dayName;
}

function getOrCreateDayMenuContainer(meal, weekKey, dayName) {
  const weekData = getWeekDataContainer(meal, weekKey);
  if (!weekData || typeof weekData !== 'object') return null;
  const alias = getExistingDayAlias(weekData, dayName);
  const dayMenu = asObject(weekData[alias]);
  if (!weekData[alias] || typeof weekData[alias] !== 'object') {
    weekData[alias] = dayMenu;
  }
  return dayMenu;
}

function applySingleRecipeOverride(override) {
  const normalized = normalizeRecipeOverrideEntry(override);
  if (!normalized) return false;

  const recipeStore = getRecipeStoreByMenu(normalized.menu);
  if (!recipeStore || typeof recipeStore !== 'object') return false;

  const weekData = getWeekDataContainer(normalized.menu, normalized.week);
  if (!weekData || typeof weekData !== 'object') return false;
  const dayAlias = getExistingDayAlias(weekData, normalized.day);
  const dayMenu = asObject(weekData[dayAlias]);
  if (!weekData[dayAlias] || typeof weekData[dayAlias] !== 'object') {
    weekData[dayAlias] = dayMenu;
  }

  const resolvedDishSlotKey = findMatchingKey(dayMenu, normalized.dishSlotKey)
    || getCategoryConfig(normalized.menu).find((category) => normalizeToken(category.key) === normalizeToken(normalized.dishSlotKey))?.key
    || '';
  if (!resolvedDishSlotKey) return false;

  const weekRecipes = asObject(recipeStore[normalized.week] || recipeStore[String(normalized.week)]);
  if (!recipeStore[normalized.week] || typeof recipeStore[normalized.week] !== 'object') {
    recipeStore[normalized.week] = weekRecipes;
  }

  const nextRecipeKey = asString(normalized.recipeKey || normalized.recipeData.title || normalized.oldRecipeKey || normalized.oldDishName).trim();
  if (!nextRecipeKey) return false;

  const normalizedRecipeData = normalizeExtractedRecipe(normalized.recipeData);
  const generatedHtml = asString(normalized.generatedHtml).trim() || buildGeneratedRecipeHtml(normalizedRecipeData);
  const recipePayload = {
    ...normalizedRecipeData,
    generatedHtml,
  };
  weekRecipes[nextRecipeKey] = recipePayload;

  if (normalized.oldRecipeKey && normalized.oldRecipeKey !== nextRecipeKey) {
    const oldRecipeKeyMatch = findMatchingKey(weekRecipes, normalized.oldRecipeKey) || normalized.oldRecipeKey;
    delete weekRecipes[oldRecipeKeyMatch];
  }

  dayMenu[resolvedDishSlotKey] = normalized.dishName || nextRecipeKey;
  console.log('OVERRIDE APPLIED:', normalized.week, normalized.day, nextRecipeKey);

  return true;
}

function applyStoredRecipeOverrides() {
  const overrides = loadRecipeOverridesFromStorage();
  asArray(overrides).forEach((override) => {
    try {
      applySingleRecipeOverride(override);
    } catch (error) {
      console.warn('Skipping invalid stored recipe override:', error);
    }
  });
}

function getCategoryConfig(meal) {
  return meal === 'dinner' ? dinnerCategoryConfig : lunchCategoryConfig;
}

function getDefaultDishText(meal) {
  return meal === 'dinner' ? 'N/A' : 'Menu item not set';
}

function renderDay(meal, weekKey, dayName) {
  const menuRow = document.getElementById('menuRow');
  const dayData = getMealMenu(meal, weekKey, dayName);
  const categories = getCategoryConfig(meal);
  const defaultDishText = getDefaultDishText(meal);

  menuRow.innerHTML = '';
  selectedDish = null;

  categories.forEach(category => {
    const itemBlock = document.createElement('div');
    itemBlock.className = 'menu-item-block';

    const label = document.createElement('div');
    label.className = 'category-label';
    label.textContent = category.label;

    const dish = document.createElement('div');
    dish.className = 'dish-name';
    const dishText = dayData[category.key] || defaultDishText;
    dish.textContent = dishText;

    itemBlock.dataset.dish = dishText;
    itemBlock.appendChild(label);
    itemBlock.appendChild(dish);
    itemBlock.addEventListener('click', () => handleDishClick(itemBlock));
    menuRow.appendChild(itemBlock);
  });

  const blocks = document.querySelectorAll('.menu-item-block');
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.dataset.dish && block.dataset.dish !== defaultDishText) {
      handleDishClick(block);
      break;
    }
  }
}

function renderMenuRow() {
  const week = asString(document.getElementById('weekSelect').value);
  const day = asString(document.getElementById('daySelect').value);
  renderDay(selectedMeal, week, day);
}

function renderIngredients() {
  const ingredientsContainer = document.getElementById('ingredientsContainer');
  ingredientsContainer.innerHTML = '';

  if (selectedMeal === 'lunch') {
    const msg = document.createElement('p');
    msg.className = 'no-results';
    msg.textContent = "Lunch ingredients checker coming next - we'll add recipes first.";
    ingredientsContainer.appendChild(msg);
    return;
  }

  const week = Number(asString(document.getElementById('weekSelect').value));
  const day = asString(document.getElementById('daySelect').value);
  const searchTerm = asString(document.getElementById('searchInput').value).trim().toLowerCase();
  const entry = asArray(ingredientDataStore && ingredientDataStore.menu).find(item => item && item.week === week && item.day === day);

  if (!entry || !entry.categories) {
    const msg = document.createElement('p');
    msg.textContent = 'No ingredients available for this day.';
    ingredientsContainer.appendChild(msg);
    return;
  }

  let hasResults = false;
  const entryCategories = asObject(entry.categories);
  for (const groupName in entryCategories) {
    if (!Object.prototype.hasOwnProperty.call(entryCategories, groupName)) continue;
    let filtered = [];
    try {
      filtered = asArray(entryCategories[groupName]).filter(item => {
        const ingredientName = stringifyIngredientValue(item && item.name != null ? item.name : item);
        if (!ingredientName) {
          console.warn(`Invalid ingredient value found in category "${groupName}"`, item);
          return false;
        }
        return ingredientName.toLowerCase().includes(searchTerm);
      });
    } catch (error) {
      console.warn(`Skipping invalid ingredients in category "${groupName}":`, error);
      filtered = [];
    }
    if (filtered.length === 0) continue;

    hasResults = true;
    const section = document.createElement('section');
    const header = document.createElement('h3');
    header.textContent = groupName.charAt(0).toUpperCase() + groupName.slice(1);
    section.appendChild(header);

    const ul = document.createElement('ul');
    filtered.forEach(item => {
      const li = document.createElement('li');
      const ingredientName = stringifyIngredientValue(item && item.name != null ? item.name : item);
      const quantityStr = item && item.quantity ? `${item.quantity} ${item.unit || ''}`.trim() : '';
      li.textContent = quantityStr ? `${quantityStr} - ${ingredientName}` : ingredientName;
      ul.appendChild(li);
    });

    section.appendChild(ul);
    ingredientsContainer.appendChild(section);
  }

  if (!hasResults) {
    const p = document.createElement('p');
    p.className = 'no-results';
    p.textContent = 'No ingredients match your search.';
    ingredientsContainer.appendChild(p);
  }
}

function renderWeek(meal, weekKey) {
  const weeklyMenuGrid = document.getElementById('weeklyMenuGrid');
  if (!weeklyMenuGrid) return;

  const categories = getCategoryConfig(meal);
  const defaultDishText = getDefaultDishText(meal);

  weeklyMenuGrid.innerHTML = '';
  dayOrder.forEach(day => {
    const dayData = getMealMenu(meal, weekKey, day);
    const dayCard = document.createElement('section');
    dayCard.className = 'day-card';

    const title = document.createElement('h2');
    title.className = 'day-card-title';
    title.textContent = day;
    dayCard.appendChild(title);

    const slots = document.createElement('div');
    slots.className = 'day-card-slots';
    categories.forEach(category => {
      const slot = document.createElement('div');
      slot.className = 'day-card-slot';

      const label = document.createElement('div');
      label.className = 'day-card-slot-label';
      label.textContent = category.label;

      const value = document.createElement('div');
      value.className = 'day-card-slot-value';
      value.textContent = dayData[category.key] || defaultDishText;

      slot.appendChild(label);
      slot.appendChild(value);
      slots.appendChild(slot);
    });

    dayCard.appendChild(slots);
    weeklyMenuGrid.appendChild(dayCard);
  });
}

function renderWeeklyView(weekId) {
  const week = weekId || document.getElementById('weekSelect').value;
  renderWeek(selectedMeal, week);
}

function getRecipeStoreByMenu(menu) {
  return menu === 'lunch' ? lunchRecipesStore : recipesStore;
}

function getApiBaseUrl() {
  const input = document.getElementById('adminApiBase');
  const raw = input ? input.value : '';
  const normalized = String(raw || '').trim().replace(/\/+$/, '');
  return normalized || DEFAULT_API_BASE_URL;
}

function getAdminSecret() {
  const input = document.getElementById('adminSecretInput');
  return input ? input.value.trim() : '';
}

function isApplyDryRunEnabled() {
  const toggle = document.getElementById('applyDryRunToggle');
  return Boolean(toggle && toggle.checked);
}

function setUpdateStatus(message, isError) {
  const status = document.getElementById('updateStatus');
  if (!status) return;
  status.textContent = message || '';
  status.style.color = isError ? '#b42318' : 'var(--brand-teal-dark)';
}

function updateDishId(menu, week, day, slot) {
  return `${menu}:week${week}:${day}:${slot}`;
}

function buildGeneratedRecipeHtml(recipeJson) {
  const normalizedRecipe = normalizeExtractedRecipe(recipeJson);
  const title = escapeHtml(normalizedRecipe.title || 'Untitled Recipe');
  const yieldLine = normalizedRecipe.servings ? `<p><strong>Yield:</strong> ${escapeHtml(normalizedRecipe.servings)}</p>` : '';
  const ingredients = normalizedRecipe.ingredients;
  const steps = normalizedRecipe.steps;

  const ingredientRows = ingredients
    .map(item => ingredientToDisplay(normalizeIngredientItem(item)))
    .filter(display => display.name)
    .map(display => `<tr><td>${escapeHtml(display.name)}</td><td>${escapeHtml(display.amount)}</td></tr>`)
    .join('');
  const noIngredientsWarning = ingredientRows ? '' : '<p class="no-ingredients-warning">No ingredients found for this recipe.</p>';

  const stepRows = steps
    .map(step => `<li><p>${escapeHtml(String(step))}</p></li>`)
    .join('');

  return `<h2>${title}</h2>${yieldLine}<h3>Ingredients</h3><table><thead><tr><th>Ingredient</th><th>Amount</th></tr></thead><tbody>${ingredientRows}</tbody></table>${noIngredientsWarning}<h3>Method</h3><ol type="1">${stepRows}</ol>`;
}

function isValidExtractedRecipe(recipeJson) {
  const normalizedRecipe = normalizeExtractedRecipe(recipeJson);
  return Boolean(
    normalizedRecipe &&
    typeof normalizedRecipe === 'object' &&
    typeof normalizedRecipe.title === 'string' &&
    Array.isArray(normalizedRecipe.ingredients) &&
    Array.isArray(normalizedRecipe.steps)
  );
}

function getSelectedUpdateContext() {
  const menu = document.getElementById('updateMenuSelect').value;
  const week = document.getElementById('updateWeekSelect').value;
  const day = document.getElementById('updateDaySelect').value;
  const dishSelect = document.getElementById('updateDishSelect');
  const selected = dishSelect && dishSelect.options.length ? dishSelect.options[dishSelect.selectedIndex] : null;
  return { menu, week, day, dishSelect, selected };
}

function deriveOldDishNameFromOption(optionEl) {
  if (!optionEl) return '';
  const datasetDishName = asString(optionEl.dataset && optionEl.dataset.dishName).trim();
  if (datasetDishName) return datasetDishName;

  const labelText = asString(optionEl.textContent).trim();
  if (!labelText) return '';

  const separatorIndex = labelText.indexOf(':');
  if (separatorIndex >= 0) {
    const parsedDishName = labelText.slice(separatorIndex + 1).trim();
    if (parsedDishName) return parsedDishName;
  }

  return labelText;
}

function buildRecipePatchPayload() {
  const { menu, week, day, selected } = getSelectedUpdateContext();
  if (!selected || !selected.value) {
    throw new Error('Select a dish slot before creating patch.');
  }
  if (!extractedRecipeDraft) {
    throw new Error('Run Extract & Preview first.');
  }
  if (!isValidExtractedRecipe(extractedRecipeDraft)) {
    throw new Error('Extracted recipe is malformed. Need title, ingredients[], and steps[].');
  }
  const normalizedDraft = normalizeExtractedRecipe(extractedRecipeDraft);
  const derivedOldDishName = deriveOldDishNameFromOption(selected);
  const oldDishName = asString(selected.dataset.dishName).trim() || derivedOldDishName;
  const oldRecipeKey = asString(selected.dataset.recipeKey).trim() || oldDishName;

  return {
    patchVersion: 1,
    createdAt: new Date().toISOString(),
    menu,
    week: Number(week),
    day,
    dishSlotId: selected.value,
    dishSlotKey: selected.dataset.slot,
    oldDishName,
    oldRecipeKey,
    recipeData: {
      title: normalizedDraft.title || '',
      servings: normalizedDraft.servings || '',
      yield: normalizedDraft.servings || '',
      ingredients: normalizedDraft.ingredients || [],
      steps: normalizedDraft.steps || [],
      sourceUrl: normalizedDraft.sourceUrl || document.getElementById('recipeUrlInput').value.trim(),
      generatedHtml: generatedRecipeHtmlDraft || buildGeneratedRecipeHtml(normalizedDraft),
    },
  };
}

function persistRecipeOverride(override) {
  const existing = loadRecipeOverridesFromStorage();
  const normalized = normalizeRecipeOverrideEntry(override);
  if (!normalized) return false;

  const retained = asArray(existing).filter((entry) => {
    const parsed = normalizeRecipeOverrideEntry(entry);
    if (!parsed) return false;
    return !(
      parsed.menu === normalized.menu &&
      parsed.week === normalized.week &&
      parsed.day === normalized.day &&
      parsed.dishSlotKey === normalized.dishSlotKey
    );
  });

  retained.push(normalized);
  return writeStorageItem(RECIPE_OVERRIDES_STORAGE_KEY, JSON.stringify(retained));
}

function applyLocalRecipePatch(patch) {
  const recipeTitle = asString(patch?.recipeData?.title).trim();
  const normalizedDishName = recipeTitle || asString(patch.oldDishName).trim();
  const generatedHtml = asString(patch?.recipeData?.generatedHtml) || buildGeneratedRecipeHtml(patch.recipeData);

  const override = {
    menu: patch.menu === 'lunch' ? 'lunch' : 'dinner',
    week: patch.week,
    day: patch.day,
    dishSlotKey: patch.dishSlotKey,
    oldRecipeKey: patch.oldRecipeKey,
    oldDishName: patch.oldDishName,
    dishName: normalizedDishName,
    recipeKey: normalizedDishName || patch.oldRecipeKey,
    generatedHtml,
    recipeData: normalizeExtractedRecipe({
      ...patch.recipeData,
      title: normalizedDishName || patch.recipeData?.title || patch.oldDishName || '',
      generatedHtml,
    }),
  };

  const applied = applySingleRecipeOverride(override);
  if (!applied) {
    throw new Error('Failed to apply local recipe update.');
  }

  const persisted = persistRecipeOverride(override);
  if (!persisted) {
    console.warn('Local recipe update applied in-memory but could not be persisted to storage.');
  }
}

function downloadPatchJson() {
  try {
    const patch = buildRecipePatchPayload();
    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `recipe_patch_${patch.menu}_week${patch.week}_${patch.day}_${patch.dishSlotKey}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    setUpdateStatus('Patch JSON downloaded. Run node scripts/applyRecipePatch.js <patch.json>.', false);
  } catch (error) {
    setUpdateStatus(error.message || String(error), true);
  }
}

function renderExtractPreview(recipeJson) {
  const normalizedRecipe = normalizeExtractedRecipe(recipeJson);
  const titleEl = document.getElementById('previewTitle');
  const ingredientsEl = document.getElementById('previewIngredients');
  const stepsEl = document.getElementById('previewSteps');
  const generatedEl = document.getElementById('previewGenerated');
  if (!titleEl || !ingredientsEl || !stepsEl || !generatedEl) return;

  titleEl.innerHTML = `<h4>${escapeHtml(normalizedRecipe.title || 'Untitled')}</h4>`;

  const ingredients = normalizedRecipe.ingredients;
  const ingredientItems = ingredients
    .map(item => ingredientToDisplay(normalizeIngredientItem(item)))
    .filter(display => display.name)
    .map(display => {
      const amount = display.amount ? `${escapeHtml(display.amount)} ` : '';
      return `<li>${amount}${escapeHtml(display.name)}</li>`;
    })
    .join('');
  ingredientsEl.innerHTML = `<h4>Ingredients</h4>${ingredientItems ? `<ul>${ingredientItems}</ul>` : '<p class="no-ingredients-warning">No ingredients found for this recipe.</p>'}`;

  const steps = normalizedRecipe.steps;
  stepsEl.innerHTML = `<h4>Steps</h4><ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`;

  generatedRecipeHtmlDraft = buildGeneratedRecipeHtml(normalizedRecipe);
  generatedEl.textContent = generatedRecipeHtmlDraft;
}

function refreshUpdateDishOptions() {
  const menu = document.getElementById('updateMenuSelect').value;
  const week = document.getElementById('updateWeekSelect').value;
  const day = document.getElementById('updateDaySelect').value;
  const dishSelect = document.getElementById('updateDishSelect');
  if (!dishSelect) return;

  const dayMenu = getMealMenu(menu, week, day);
  const recipeStore = getRecipeStoreByMenu(menu) || {};
  const weekRecipes = recipeStore[week] || recipeStore[String(week)] || {};
  const categories = getCategoryConfig(menu);

  dishSelect.innerHTML = '';

  categories.forEach(category => {
    const slot = category.key;
    const dishName = dayMenu[slot];
    if (!dishName) return;

    const recipeKey = findRecipeKey(weekRecipes, dishName);
    const dishId = updateDishId(menu, week, day, slot);
    const option = document.createElement('option');
    option.value = dishId;
    option.dataset.recipeKey = recipeKey || '';
    option.dataset.slot = slot;
    option.dataset.dishName = dishName;
    option.textContent = `${slot}: ${dishName}`;
    dishSelect.appendChild(option);
  });

  if (!dishSelect.options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No dishes found for selected day';
    dishSelect.appendChild(option);
  }
}

async function handleExtractPreview() {
  const apiBase = getApiBaseUrl();
  const url = document.getElementById('recipeUrlInput').value.trim();

  if (!apiBase) {
    setUpdateStatus('Backend API Base URL is required.', true);
    return;
  }
  if (!url) {
    setUpdateStatus('Recipe URL is required.', true);
    return;
  }

  setUpdateStatus('Extracting recipe...', false);
  try {
    const response = await fetch(`${apiBase}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Extract failed (${response.status}): ${errorText}`);
    }
    const extractResponse = await response.json();
    console.log('Extract response:', extractResponse);
    if (extractResponse && extractResponse.ok === false) {
      throw new Error(extractResponse.error || 'Extract failed');
    }
    const recipePayload = extractResponse && extractResponse.extractedRecipe ? extractResponse.extractedRecipe : extractResponse;
    const recipeJson = normalizeExtractedRecipe(recipePayload);
    if (!isValidExtractedRecipe(recipeJson)) {
      throw new Error('Backend returned malformed recipe JSON (title/ingredients/steps required).');
    }
    extractedRecipeDraft = recipeJson;
    renderExtractPreview(recipeJson);
    setUpdateStatus('Recipe extracted. Review preview, then Apply Update.', false);
  } catch (error) {
    setUpdateStatus(error.message || String(error), true);
  }
}

async function handleApplyUpdate() {
  try {
    const apiBase = getApiBaseUrl();
    const patch = buildRecipePatchPayload();
    const adminSecret = getAdminSecret();
    if (!adminSecret) {
      applyLocalRecipePatch(patch);
      buildIngredientCheckerData();
      renderMenuRow();
      renderIngredients();
      renderWeeklyView(document.getElementById('weekSelect').value);
      refreshUpdateDishOptions();
      setUpdateStatus('Update saved locally (no admin secret provided). Reload to confirm persistence.', false);
      return;
    }

    if (!apiBase) {
      throw new Error('Backend API Base URL is required.');
    }

    const dryRun = isApplyDryRunEnabled();
    const apiBaseUrl = apiBase.replace(/\/+$/, '');
    const applyUrl = `${apiBaseUrl}/apply${dryRun ? '?dryRun=true' : ''}`;
    console.log('applyUrl', applyUrl);
    console.log('Apply URL:', applyUrl);
    const newDishName = asString(patch?.recipeData?.title).trim() || asString(patch.oldDishName).trim();
    const newRecipeHtml = asString(patch?.recipeData?.generatedHtml) || buildGeneratedRecipeHtml(patch.recipeData);
    const payload = {
      menu: patch.menu === 'dinner' ? 'dinner' : 'lunch',
      week: patch.week,
      day: patch.day,
      slotKey: patch.dishSlotKey,
      oldDishName: patch.oldDishName || '',
      newDishName,
      newRecipeHtml,
    };
    console.log('Apply payload:', JSON.stringify(payload));

    setUpdateStatus(dryRun ? 'Running apply dry-run...' : 'Applying update and committing to GitHub...', false);

    const res = await fetch(applyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret
      },
      body: JSON.stringify(payload)
    });

    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();
    let data = null;
    data = safeParse(rawText, null);

    console.log('Apply status:', res.status);
    console.log('Apply content-type:', contentType);
    console.log('Apply response raw:', rawText);
    console.log('Apply response parsed:', data);

    if (!res.ok) {
      const backendError = (data && data.error) || rawText || '';
      if (res.status === 401) {
        throw new Error(`Unauthorized (401): check Admin Secret. ${backendError}`.trim());
      }
      if (res.status === 400) {
        throw new Error(`Bad request (400): ${backendError || 'Invalid apply payload.'}`);
      }
      throw new Error(`HTTP ${res.status}: ${backendError}`);
    }

    if (!data || data.ok !== true) {
      throw new Error(data?.error || rawText || 'Unknown error (no body)');
    }

    if (dryRun) {
      setUpdateStatus('Dry run succeeded. Validation passed and no commit was made.', false);
      return;
    }

    const recipeSha = asString(data.recipeCommitSha).trim();
    const menuSha = asString(data.menuCommitSha).trim();
    const recipeInfo = recipeSha ? `Recipe commit: ${recipeSha}. ` : '';
    const menuInfo = menuSha ? `Menu commit: ${menuSha}. ` : '';
    buildIngredientCheckerData();
    renderMenuRow();
    renderIngredients();
    renderWeeklyView(document.getElementById('weekSelect').value);
    refreshUpdateDishOptions();
    setUpdateStatus(`${recipeInfo}${menuInfo}Update applied to GitHub. GitHub Pages may take 1-3 minutes; hard refresh (Ctrl+F5).`, false);
  } catch (error) {
    console.error('Update apply failed:', error);
    setUpdateStatus(error.message || String(error), true);
  }
}

function getSelectedExportWeek() {
  const exportWeekSelect = document.getElementById('exportWeekSelect');
  return exportWeekSelect && exportWeekSelect.value ? String(exportWeekSelect.value) : '1';
}

function syncExportWeekWithMainWeek() {
  const weekSelect = document.getElementById('weekSelect');
  const exportWeekSelect = document.getElementById('exportWeekSelect');
  if (!weekSelect || !exportWeekSelect) return;

  const weekValue = String(weekSelect.value || '');
  if (['1', '2', '3', '4'].includes(weekValue)) {
    exportWeekSelect.value = weekValue;
  }
}

function downloadIngredientsExport(meal) {
  const week = getSelectedExportWeek();
  const normalizedMeal = meal === 'lunch' ? 'lunch' : 'dinner';
  const fileName = `ingredients_${normalizedMeal}_week${week}.xlsx`;
  window.location.href = `${EXPORT_BASE_PATH}/${fileName}`;
}

function downloadGroceryExport(meal) {
  const week = getSelectedExportWeek();
  const normalizedMeal = meal === 'lunch' ? 'lunch' : meal === 'dinner' ? 'dinner' : 'combined';
  const fileName = `grocery_${normalizedMeal}_week${week}.xlsx`;
  window.location.href = `${EXPORT_BASE_PATH}/${fileName}`;
}

function downloadCombinedMissingInventoryReport() {
  const week = getSelectedExportWeek();
  const fileName = `missing_from_inventory_week${week}_combined.json`;
  window.location.href = `${REPORT_BASE_PATH}/${fileName}`;
}

function setDaySelectorVisibility(showDaySelector) {
  const dayFilterGroup = document.getElementById('dayFilterGroup');
  const daySelect = document.getElementById('daySelect');
  if (!dayFilterGroup || !daySelect) return;

  dayFilterGroup.classList.toggle('hidden', !showDaySelector);
  daySelect.disabled = !showDaySelector;
}

function switchTab(tab) {
  const recipeTab = document.getElementById('recipeTab');
  const ingredientTab = document.getElementById('ingredientTab');
  const weeklyTab = document.getElementById('weeklyTab');
  const updateTab = document.getElementById('updateTab');
  const recipesView = document.getElementById('recipesView');
  const weeklyView = document.getElementById('weeklyView');
  const updateView = document.getElementById('updateView');
  const mobileMode = tab === 'ingredients' ? 'ingredients' : 'recipes';

  recipesView.dataset.mobileView = mobileMode;

  if (tab === 'recipes') {
    recipeTab.classList.add('active');
    ingredientTab.classList.remove('active');
    weeklyTab.classList.remove('active');
    updateTab.classList.remove('active');
    recipesView.classList.add('active');
    weeklyView.classList.remove('active');
    updateView.classList.remove('active');
    setDaySelectorVisibility(true);
  } else if (tab === 'ingredients') {
    recipeTab.classList.remove('active');
    ingredientTab.classList.add('active');
    weeklyTab.classList.remove('active');
    updateTab.classList.remove('active');
    recipesView.classList.add('active');
    weeklyView.classList.remove('active');
    updateView.classList.remove('active');
    setDaySelectorVisibility(true);
  } else if (tab === 'weekly') {
    recipeTab.classList.remove('active');
    ingredientTab.classList.remove('active');
    weeklyTab.classList.add('active');
    updateTab.classList.remove('active');
    recipesView.classList.remove('active');
    weeklyView.classList.add('active');
    updateView.classList.remove('active');
    setDaySelectorVisibility(false);
    renderWeeklyView(document.getElementById('weekSelect').value);
  } else {
    recipeTab.classList.remove('active');
    ingredientTab.classList.remove('active');
    weeklyTab.classList.remove('active');
    updateTab.classList.add('active');
    recipesView.classList.remove('active');
    weeklyView.classList.remove('active');
    updateView.classList.add('active');
    setDaySelectorVisibility(false);
    refreshUpdateDishOptions();
  }
}

function setMeal(meal) {
  selectedMeal = meal;
  const dinnerMealTab = document.getElementById('dinnerMealTab');
  const lunchMealTab = document.getElementById('lunchMealTab');

  dinnerMealTab.classList.toggle('active', meal === 'dinner');
  lunchMealTab.classList.toggle('active', meal === 'lunch');
  document.body.classList.toggle('lunch-mode', meal === 'lunch');

  populateWeeks(selectedMeal);
  populateDays();
  syncExportWeekWithMainWeek();

  renderMenuRow();
  renderIngredients();

  if (document.getElementById('weeklyView').classList.contains('active')) {
    renderWeeklyView(document.getElementById('weekSelect').value);
  }
}

function attachEvents() {
  const weekSelect = document.getElementById('weekSelect');
  const daySelect = document.getElementById('daySelect');
  const searchInput = document.getElementById('searchInput');
  const recipeTab = document.getElementById('recipeTab');
  const ingredientTab = document.getElementById('ingredientTab');
  const weeklyTab = document.getElementById('weeklyTab');
  const updateTab = document.getElementById('updateTab');
  const dinnerMealTab = document.getElementById('dinnerMealTab');
  const lunchMealTab = document.getElementById('lunchMealTab');
  const exportWeekSelect = document.getElementById('exportWeekSelect');
  const downloadLunchIngredientsBtn = document.getElementById('downloadLunchIngredientsBtn');
  const downloadDinnerIngredientsBtn = document.getElementById('downloadDinnerIngredientsBtn');
  const downloadLunchGroceryBtn = document.getElementById('downloadLunchGroceryBtn');
  const downloadDinnerGroceryBtn = document.getElementById('downloadDinnerGroceryBtn');
  const downloadCombinedGroceryBtn = document.getElementById('downloadCombinedGroceryBtn');
  const downloadCombinedInventoryMissingBtn = document.getElementById('downloadCombinedInventoryMissingBtn');
  const updateMenuSelect = document.getElementById('updateMenuSelect');
  const updateWeekSelect = document.getElementById('updateWeekSelect');
  const updateDaySelect = document.getElementById('updateDaySelect');
  const adminApiBaseInput = document.getElementById('adminApiBase');
  const extractPreviewBtn = document.getElementById('extractPreviewBtn');
  const applyUpdateBtn = document.getElementById('applyUpdateBtn');
  const downloadPatchBtn = document.getElementById('downloadPatchBtn');

  weekSelect.addEventListener('change', () => {
    syncExportWeekWithMainWeek();
    const isWeeklyActive = document.getElementById('weeklyView').classList.contains('active');
    if (!isWeeklyActive) {
      populateDays();
      renderMenuRow();
      renderIngredients();
    }
    renderWeeklyView(weekSelect.value);
  });

  daySelect.addEventListener('change', () => {
    renderMenuRow();
    renderIngredients();
  });

  searchInput.addEventListener('input', renderIngredients);
  recipeTab.addEventListener('click', () => switchTab('recipes'));
  ingredientTab.addEventListener('click', () => switchTab('ingredients'));
  weeklyTab.addEventListener('click', () => switchTab('weekly'));
  updateTab.addEventListener('click', () => switchTab('update'));
  dinnerMealTab.addEventListener('click', () => setMeal('dinner'));
  lunchMealTab.addEventListener('click', () => setMeal('lunch'));
  downloadLunchIngredientsBtn.addEventListener('click', () => downloadIngredientsExport('lunch'));
  downloadDinnerIngredientsBtn.addEventListener('click', () => downloadIngredientsExport('dinner'));
  downloadLunchGroceryBtn.addEventListener('click', () => downloadGroceryExport('lunch'));
  downloadDinnerGroceryBtn.addEventListener('click', () => downloadGroceryExport('dinner'));
  downloadCombinedGroceryBtn.addEventListener('click', () => downloadGroceryExport('combined'));
  downloadCombinedInventoryMissingBtn.addEventListener('click', downloadCombinedMissingInventoryReport);
  updateMenuSelect.addEventListener('change', refreshUpdateDishOptions);
  updateWeekSelect.addEventListener('change', refreshUpdateDishOptions);
  updateDaySelect.addEventListener('change', refreshUpdateDishOptions);
  adminApiBaseInput.addEventListener('input', () => {
    const normalized = asString(adminApiBaseInput.value).trim().replace(/\/+$/, '') || DEFAULT_API_BASE_URL;
    adminApiBaseInput.value = normalized;
    writeStorageItem(API_BASE_STORAGE_KEY, normalized);
  });
  extractPreviewBtn.addEventListener('click', handleExtractPreview);
  applyUpdateBtn.addEventListener('click', handleApplyUpdate);
  downloadPatchBtn.addEventListener('click', downloadPatchJson);
}

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Initialization failed: required element #${id} was not found.`);
  }
  return element;
}

function renderBootErrorsBanner() {
  if (!bootErrors.length) return;
  const shell = document.querySelector('.dashboard-shell');
  if (!shell) return;

  let banner = document.getElementById('dataLoadBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'dataLoadBanner';
    banner.className = 'data-load-banner';
    shell.prepend(banner);
  }

  banner.textContent = `Recipe data failed to load. Check frontend/data/recipes.json. ${bootErrors.join(' | ')}`;
}

function validateRequiredSelectors() {
  [
    'weekSelect',
    'daySelect',
    'dayFilterGroup',
    'menuRow',
    'recipeDetails',
    'ingredientsContainer',
    'searchInput',
    'recipeTab',
    'ingredientTab',
    'weeklyTab',
    'updateTab',
    'dinnerMealTab',
    'lunchMealTab',
    'exportWeekSelect',
    'downloadLunchIngredientsBtn',
    'downloadDinnerIngredientsBtn',
    'downloadLunchGroceryBtn',
    'downloadDinnerGroceryBtn',
    'downloadCombinedGroceryBtn',
    'downloadCombinedInventoryMissingBtn',
    'updateView',
    'adminApiBase',
    'adminSecretInput',
    'applyDryRunToggle',
    'updateMenuSelect',
    'updateWeekSelect',
    'updateDaySelect',
    'updateDishSelect',
    'recipeUrlInput',
    'extractPreviewBtn',
    'applyUpdateBtn',
    'downloadPatchBtn',
    'updateStatus',
    'previewTitle',
    'previewIngredients',
    'previewSteps',
    'previewGenerated',
    'recipesView',
    'weeklyView',
    'weeklyMenuGrid'
  ].forEach(requireElement);
}

function registerTestHooks() {
  try {
    globalThis.__chefDashboardTestHooks = {
      setExtractedRecipeDraft(recipeJson) {
        const normalized = normalizeExtractedRecipe(recipeJson);
        extractedRecipeDraft = normalized;
        renderExtractPreview(normalized);
      },
      getStoredOverrides() {
        return loadRecipeOverridesFromStorage();
      },
      clearStoredOverrides() {
        removeStorageItem(RECIPE_OVERRIDES_STORAGE_KEY);
      },
      applySingleRecipeOverride(override) {
        return applySingleRecipeOverride(override);
      },
      persistRecipeOverride(override) {
        return persistRecipeOverride(override);
      },
      rebuildIngredientCheckerData() {
        buildIngredientCheckerData();
      },
      getRecipeFromStore(menu, week, key) {
        const store = getRecipeStoreByMenu(normalizeMenuName(menu));
        const weekKey = normalizeWeekValue(week);
        const weekRecipes = asObject(store && (store[weekKey] || store[String(weekKey)]));
        const resolvedKey = findMatchingKey(weekRecipes, key) || key;
        return weekRecipes[resolvedKey] || null;
      }
    };
  } catch (_error) {
    // Hooks are best-effort and only used by automated tests.
  }
}

async function init() {
  validateRequiredSelectors();
  await loadRecipeStores();
  cleanUpStorage();
  applyStoredRecipeOverrides();
  registerTestHooks();
  renderBootErrorsBanner();

  const apiBaseInput = document.getElementById('adminApiBase');
  if (apiBaseInput) {
    const storedBase = normalizeStorageApiBase(readStorageItem(API_BASE_STORAGE_KEY));
    const resolvedBase = (storedBase || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '');
    apiBaseInput.value = resolvedBase;
  }

  if (!mealData.dinner || !Object.keys(mealData.dinner).length) {
    console.warn('Dinner menu data failed to load; week/day dropdowns cannot be populated.');
    return;
  }

  if (!mealData.lunch || !Object.keys(mealData.lunch).length) {
    console.warn('Lunch menu data failed to load; lunch view may not render menu cards.');
  }

  if (!recipesStore || !lunchRecipesStore) {
    console.warn('Recipe data is missing or invalid; recipe rendering will be limited.');
  }

  populateWeeks(selectedMeal);
  populateDays();
  syncExportWeekWithMainWeek();

  try {
    buildIngredientCheckerData();
  } catch (error) {
    console.warn('Failed to build ingredient checker data:', error);
  }

  document.getElementById('updateWeekSelect').value = document.getElementById('weekSelect').value || '1';
  document.getElementById('updateMenuSelect').value = 'dinner';
  refreshUpdateDishOptions();

  setMeal('dinner');
  renderWeeklyView(document.getElementById('weekSelect').value);
  attachEvents();
  switchTab('recipes');
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    Promise.resolve(init()).catch((error) => {
      console.error(error.message || error);
    });
  } catch (error) {
    console.error(error.message || error);
  }
});
