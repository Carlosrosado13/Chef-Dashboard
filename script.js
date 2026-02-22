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
    reportBootError(`Recipe data failed to load. Check recipes.js/recipeslunch.js (${label}).`);
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
const dinnerRecipesGlobal = resolveGlobalValue('recipesData') || null;
const lunchRecipesGlobal = resolveGlobalValue('recipesLunchData') || null;
console.log('recipesData global (window):', window.recipesData ?? null);
console.log('recipesLunchData global (window):', window.recipesLunchData ?? null);
console.log('recipesData resolved:', dinnerRecipesGlobal);
console.log('recipesLunchData resolved:', lunchRecipesGlobal);
if (!dinnerRecipesGlobal) {
  console.error('Dinner recipes missing');
}
if (!lunchRecipesGlobal) {
  console.error('Lunch recipes missing');
}
const recipesStore = validateRecipeData('Dinner Recipes', dinnerRecipesGlobal);
const lunchRecipesStore = validateRecipeData('Lunch Recipes', lunchRecipesGlobal) || {};

let selectedDish = null;
let selectedMeal = 'dinner';
let extractedRecipeDraft = null;
let generatedRecipeHtmlDraft = '';

const ingredientCategories = ['produce', 'protein', 'dairy', 'dry', 'other'];
const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EXPORT_BASE_PATH = 'data/exports';
const REPORT_BASE_PATH = 'data/reports';
const WEEKLY_DAY_KEYS = {
  Monday: ['Monday', 'Mon'],
  Tuesday: ['Tuesday', 'Tue', 'Tues'],
  Wednesday: ['Wednesday', 'Wed'],
  Thursday: ['Thursday', 'Thu', 'Thur', 'Thurs'],
  Friday: ['Friday', 'Fri'],
  Saturday: ['Saturday', 'Sat'],
  Sunday: ['Sunday', 'Sun']
};

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
    servings: source.servings == null ? '' : String(source.servings),
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

function buildCategoryLookup() {
  const lookup = {};
  if (!ingredientDataStore || !Array.isArray(ingredientDataStore.menu)) return lookup;
  ingredientDataStore.menu.forEach(entry => {
    if (!entry || !entry.categories) return;
    ingredientCategories.forEach(category => {
      const items = entry.categories[category] || [];
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

  Object.keys(dinnerOverview).forEach(weekKey => {
    const weekNumber = Number(weekKey);
    const weekDays = dinnerOverview[weekKey];
    Object.keys(weekDays).forEach(day => {
      const categories = { produce: [], protein: [], dairy: [], dry: [], other: [] };
      const seenByCategory = { produce: new Set(), protein: new Set(), dairy: new Set(), dry: new Set(), other: new Set() };
      const dayMenu = weekDays[day];
      const weekRecipes = recipesStore[weekKey] || {};

      Object.keys(dayMenu).forEach(menuCategory => {
        const dishName = dayMenu[menuCategory];
        if (!dishName || /^(n\/a|add alternative)$/i.test(dishName.trim())) return;
        const recipeKey = findRecipeKey(weekRecipes, dishName);
        if (!recipeKey) return;

        try {
          parseIngredientsFromRecipeHtml(weekRecipes[recipeKey]).forEach(ingredient => {
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
  const weeks = new Set(ingredientDataStore.menu.map(entry => entry.week));
  let totalIngredients = 0;
  const emptyWeeks = [];

  weeks.forEach(week => {
    const weekEntries = ingredientDataStore.menu.filter(entry => entry.week === week);
    const seen = new Set();
    let count = 0;
    weekEntries.forEach(entry => {
      ingredientCategories.forEach(category => {
        (entry.categories[category] || []).forEach(item => {
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
    recipeDetails.innerHTML = '<p>Recipe data failed to load. Check recipes.js/recipeslunch.js.</p>';
    return;
  }
  const weekRecipes = store && store[week];
  if (!weekRecipes) {
    recipeDetails.innerHTML = '<p>Recipe data not available for this week.</p>';
    return;
  }

  const bestKey = findRecipeKey(weekRecipes, selectedDish);
  if (bestKey) {
    recipeDetails.innerHTML = weekRecipes[bestKey];
  } else {
    recipeDetails.innerHTML = '<p>Recipe not available for the selected dish.</p>';
  }
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
  const currentWeek = weekSelect.value;
  weekSelect.innerHTML = '';

  const mealWeeks = getWeekDataForMeal(meal);
  Object.keys(mealWeeks)
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
  const week = weekSelect.value;
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
  const week = document.getElementById('weekSelect').value;
  const day = document.getElementById('daySelect').value;
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

  const week = Number(document.getElementById('weekSelect').value);
  const day = document.getElementById('daySelect').value;
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  const entry = ingredientDataStore.menu.find(item => item.week === week && item.day === day);

  if (!entry || !entry.categories) {
    const msg = document.createElement('p');
    msg.textContent = 'No ingredients available for this day.';
    ingredientsContainer.appendChild(msg);
    return;
  }

  let hasResults = false;
  for (const groupName in entry.categories) {
    if (!Object.prototype.hasOwnProperty.call(entry.categories, groupName)) continue;
    let filtered = [];
    try {
      filtered = (entry.categories[groupName] || []).filter(item => {
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
  return input ? input.value.trim().replace(/\/+$/, '') : '';
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
  const ingredients = normalizedRecipe.ingredients;
  const steps = normalizedRecipe.steps;

  const ingredientRows = ingredients
    .map(item => {
      const safeItem = normalizeIngredientItem(item);
      const qty = safeItem.qty == null ? '' : String(safeItem.qty);
      const unit = safeItem.unit ? String(safeItem.unit) : '';
      const notes = safeItem.notes ? ` (${String(safeItem.notes)})` : '';
      const ingredientName = `${safeItem.name}${notes}`.trim();
      return `<tr><td>${escapeHtml(ingredientName)}</td><td>${escapeHtml(`${qty} ${unit}`.trim())}</td></tr>`;
    })
    .join('');

  const stepRows = steps
    .map(step => `<li><p>${escapeHtml(String(step))}</p></li>`)
    .join('');

  return `<h2>${title}</h2><h3>Ingredients</h3><table><thead><tr><th>Ingredient</th><th>Amount</th></tr></thead><tbody>${ingredientRows}</tbody></table><h3>Method</h3><ol type="1">${stepRows}</ol>`;
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

  return {
    patchVersion: 1,
    createdAt: new Date().toISOString(),
    menu,
    week: Number(week),
    day,
    dishSlotId: selected.value,
    dishSlotKey: selected.dataset.slot,
    oldDishName: selected.dataset.dishName || '',
    oldRecipeKey: selected.dataset.recipeKey || '',
    recipeData: {
      title: normalizedDraft.title || '',
      servings: normalizedDraft.servings || '',
      ingredients: normalizedDraft.ingredients || [],
      steps: normalizedDraft.steps || [],
      sourceUrl: normalizedDraft.sourceUrl || document.getElementById('recipeUrlInput').value.trim(),
      generatedHtml: generatedRecipeHtmlDraft || buildGeneratedRecipeHtml(normalizedDraft),
    },
  };
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
  ingredientsEl.innerHTML = `<h4>Ingredients</h4><ul>${ingredients
    .map(item => {
      const safeItem = normalizeIngredientItem(item);
      const qty = safeItem.qty == null ? '' : `${safeItem.qty}`;
      const unit = safeItem.unit || '';
      const notes = safeItem.notes ? ` (${safeItem.notes})` : '';
      return `<li>${escapeHtml(`${qty} ${unit}`.trim())} ${escapeHtml(safeItem.name || '')}${escapeHtml(notes)}</li>`;
    })
    .join('')}</ul>`;

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
    if (!apiBase) {
      throw new Error('Backend API Base URL is required.');
    }

    const adminSecret = getAdminSecret();
    if (!adminSecret) {
      throw new Error('Admin Secret is required for Apply Update.');
    }

    const patch = buildRecipePatchPayload();
    const dryRun = isApplyDryRunEnabled();
    const applyUrl = `${apiBase}/apply${dryRun ? '?dryRun=true' : ''}`;
    const payload = {
      menu: patch.menu === 'dinner' ? 'Dinner' : 'Lunch',
      week: patch.week,
      day: patch.day,
      dishSlotId: patch.dishSlotId,
      extractedRecipe: patch.recipeData,
      dishId: patch.dishSlotId,
      dishSlot: patch.dishSlotKey,
      dishName: patch.oldDishName || '',
      recipeKey: patch.oldRecipeKey || patch.oldDishName || '',
      recipeJson: patch.recipeData,
    };
    console.log('Apply payload:', payload);

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
    try {
      data = JSON.parse(rawText);
    } catch (_error) {
      data = null;
    }

    console.log('Apply status:', res.status);
    console.log('Apply content-type:', contentType);
    console.log('Apply response raw:', rawText);
    console.log('Apply response parsed:', data);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${rawText}`);
    }

    if (!data || data.ok !== true) {
      throw new Error(data?.error || rawText || 'Unknown error (no body)');
    }

    if (data.status === 'patch_required') {
      downloadPatchJson();
      const command = data.command || 'node scripts/applyRecipePatch.js <patch.json>';
      setUpdateStatus(`Patch generated. To apply: ${command} then git add/commit/push.`, false);
      return;
    }

    if (dryRun) {
      setUpdateStatus('Dry run succeeded. Validation passed and no commit was made.', false);
      return;
    }

    const sha = data.commitSha ? `Commit: ${data.commitSha}` : 'Commit: n/a';
    const file = data.updatedFile ? ` File: ${data.updatedFile}.` : '';
    if (data.commitSha) {
      console.log('Apply commitSha:', data.commitSha);
    }
    const url = data.url || data.commitUrl || '';
    const suffix = url ? ` ${url}` : '';
    setUpdateStatus(`${sha}.${file}${suffix} GitHub Pages may take 1-3 minutes; hard refresh (Ctrl+F5).`, false);
  } catch (error) {
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

  banner.textContent = `Recipe data failed to load. Check recipes.js/recipeslunch.js. ${bootErrors.join(' | ')}`;
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

function init() {
  validateRequiredSelectors();
  renderBootErrorsBanner();

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
    init();
  } catch (error) {
    console.error(error.message || error);
  }
});
