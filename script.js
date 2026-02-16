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
    if (name === 'lunchRecipesWeek1' && typeof lunchRecipesWeek1 !== 'undefined') return lunchRecipesWeek1;
  }

  return undefined;
}

const ingredientDataStore = resolveGlobalValue('menuData') || { menu: [] };
const dinnerMenuDataStore = resolveGlobalValue('dinnerMenuData', 'menuOverviewData') || {};
const lunchMenuDataStore = resolveGlobalValue('lunchMenuData') || {};
const mealData = {
  dinner: dinnerMenuDataStore,
  lunch: lunchMenuDataStore
};
const recipesStore = resolveGlobalValue('recipesData') || null;
const lunchRecipesStore = resolveGlobalValue('lunchRecipesWeek1') || {};

let selectedDish = null;
let selectedMeal = 'dinner';

const ingredientCategories = ['produce', 'protein', 'dairy', 'dry', 'other'];
const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKLY_DAY_KEYS = {
  Monday: ['Monday', 'Mon'],
  Tuesday: ['Tuesday', 'Tue', 'Tues'],
  Wednesday: ['Wednesday', 'Wed'],
  Thursday: ['Thursday', 'Thu', 'Thur', 'Thurs'],
  Friday: ['Friday', 'Fri'],
  Saturday: ['Saturday', 'Sat'],
  Sunday: ['Sunday', 'Sun']
};

function normalizeName(name) {
  if (!name) return '';
  let cleaned = name.replace(/\([^)]*\)/g, '');
  cleaned = cleaned.replace(/[-,]/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, 'and');
  cleaned = cleaned.replace(/\bwith\b/gi, ' ');
  cleaned = cleaned.replace(/\band\b/gi, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.toLowerCase();
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
  const cleaned = stripHtml(value).replace(/,/g, '.');
  if (!cleaned) return { quantity: null, unit: '' };
  if (/to taste/i.test(cleaned)) return { quantity: null, unit: 'to taste' };

  const fractionMap = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
  const directFraction = cleaned.match(/^([½¼¾⅓⅔⅛])(?:\s+(.*))?$/);
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

  const mixedFraction = cleaned.match(/^(\d+)\s+([½¼¾⅓⅔⅛])(?:\s+(.*))?$/);
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
  if (!recipeHtml) return rows;
  const trMatches = recipeHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  trMatches.forEach(row => {
    const tdMatches = row.match(/<td[\s\S]*?<\/td>/gi) || [];
    if (tdMatches.length < 2) return;
    const ingredientName = stripHtml(tdMatches[0]);
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
        const key = normalizeName(item.name);
        if (key && !lookup[key]) lookup[key] = category;
      });
    });
  });
  return lookup;
}

function findRecipeKey(weekRecipes, dishName) {
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

        parseIngredientsFromRecipeHtml(weekRecipes[recipeKey]).forEach(ingredient => {
          const normalized = normalizeName(ingredient.name);
          if (!normalized) return;
          const category = categoryLookup[normalized] || 'other';
          if (seenByCategory[category].has(normalized)) return;
          seenByCategory[category].add(normalized);
          categories[category].push(ingredient);
        });
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
          const key = `${entry.day}|${category}|${normalizeName(item.name)}`;
          if (seen.has(key)) {
            throw new Error(`Duplicate ingredient found in week ${week}: ${item.name} (${entry.day})`);
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

function normalizeLunchRecipeTitle(value) {
  if (!value) return '';
  return String(value)
    .replace(/\((?:\s*(?:GF|DF|VG|V|VEG|NF|SF)(?:\s*\/\s*(?:GF|DF|VG|V|VEG|NF|SF))*\s*)\)/gi, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeInstructionValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(line => String(line || '').trim())
      .filter(Boolean)
      .join('\n');
  }
  return String(value || '').trim();
}

function isMissingInstructionValue(value) {
  const normalized = normalizeInstructionValue(value).toLowerCase();
  return !normalized || normalized === 'recipe added.' || normalized === 'recipe not added yet';
}

function extractLunchDressingTitle(saladTitle) {
  const clean = String(saladTitle || '').trim();
  if (!clean) return '';

  const slashParts = clean.split('/').map(part => part.trim()).filter(Boolean);
  if (slashParts.length > 1) {
    return slashParts[slashParts.length - 1];
  }

  const parenMatch = clean.match(/\(([^)]+dressing[^)]*)\)/i);
  if (parenMatch) return parenMatch[1].trim();
  return '';
}

function buildLunchSlotExpectedTitle(slot, dayMenu) {
  if (!dayMenu) return '';
  if (slot.key === 'soup') return dayMenu.SOUP || '';
  if (slot.key === 'salad') return dayMenu.SALAD || '';
  if (slot.key === 'main1') return dayMenu['MAIN 1'] || '';
  if (slot.key === 'main2') return dayMenu['MAIN 2'] || '';
  if (slot.key === 'dessert') return dayMenu.DESSERT || '';
  if (slot.key === 'saladDressing') return extractLunchDressingTitle(dayMenu.SALAD || '');
  return '';
}

function scoreTitleWordOverlap(left, right) {
  const leftWords = normalizeLunchRecipeTitle(left).split(/\s+/).filter(Boolean);
  const rightWords = normalizeLunchRecipeTitle(right).split(/\s+/).filter(Boolean);
  if (!leftWords.length || !rightWords.length) return 0;
  const common = leftWords.filter(word => rightWords.includes(word));
  return common.length / Math.min(leftWords.length, rightWords.length);
}

function findLunchRecipeByTitle(dayRecipes, expectedTitle) {
  if (!dayRecipes || !expectedTitle) return null;
  const target = normalizeLunchRecipeTitle(expectedTitle);
  if (!target) return null;

  let best = null;
  let bestScore = 0;

  Object.keys(dayRecipes).forEach(key => {
    const candidate = dayRecipes[key];
    if (!candidate || typeof candidate !== 'object') return;
    const title = candidate.title || '';
    const normalizedTitle = normalizeLunchRecipeTitle(title);
    if (!normalizedTitle) return;
    if (normalizedTitle === target) {
      best = candidate;
      bestScore = 1;
      return;
    }
    const score = scoreTitleWordOverlap(normalizedTitle, target);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return bestScore >= 0.5 ? best : null;
}

function resolveLunchRecipeForSlot({ week, day, slot, dayRecipes, dayMenu }) {
  const expectedTitle = buildLunchSlotExpectedTitle(slot, dayMenu) || slot.label;
  let recipe = dayRecipes[slot.key] || null;

  if (!recipe && slot.key === 'saladDressing') {
    recipe = dayRecipes.dressing || dayRecipes.vinaigrette || dayRecipes.side || null;
  }

  const hasUsableInstructions = recipe && !isMissingInstructionValue(recipe.instructions);
  if (!recipe || !hasUsableInstructions) {
    const byTitle = findLunchRecipeByTitle(dayRecipes, expectedTitle);
    if (byTitle && !isMissingInstructionValue(byTitle.instructions)) recipe = byTitle;
  }

  return { recipe, expectedTitle, context: { week, day, meal: 'lunch' } };
}

function renderLunchRecipeCard(recipe, expectedTitle, context) {
  if (!recipe) {
    console.warn('Missing recipe instructions for:', expectedTitle || 'Unknown lunch recipe', context);
    return '<section class="recipe-card"><p>Recipe not added yet</p></section>';
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const ingredientRows = ingredients.length
    ? ingredients
      .map(item => `<tr><td>${escapeHtml(item.item)}</td><td>${escapeHtml(item.qty50)}</td><td>${escapeHtml(item.qty100)}</td><td>${escapeHtml(item.qty150)}</td></tr>`)
      .join('')
    : '<tr><td colspan="4">Recipe not added yet</td></tr>';

  const yields = Array.isArray(recipe.yields) ? recipe.yields : ['50', '100', '150'];
  const notes = recipe.notes ? `<p><strong>Notes:</strong> ${escapeHtml(recipe.notes)}</p>` : '';
  const instructionsText = normalizeInstructionValue(recipe.instructions);
  const safeInstructions = isMissingInstructionValue(instructionsText) ? 'Recipe not added yet' : instructionsText;

  if (safeInstructions === 'Recipe not added yet') {
    console.warn('Missing recipe instructions for:', expectedTitle || recipe.title, context);
  }

  return `<section class="recipe-card"><h3>${escapeHtml(recipe.title || 'Recipe not added yet')}</h3><p><strong>Yields:</strong> ${escapeHtml(yields.join(', '))}</p><table><thead><tr><th>Ingredient</th><th>${escapeHtml(yields[0])}</th><th>${escapeHtml(yields[1])}</th><th>${escapeHtml(yields[2])}</th></tr></thead><tbody>${ingredientRows}</tbody></table><h4>Instructions</h4><pre>${escapeHtml(safeInstructions)}</pre>${notes}</section>`;
}

function renderLunchRecipesByDay(week, day) {
  const container = lunchRecipesStore[`Week ${week}`] || lunchRecipesStore[String(week)] || {};
  const dayRecipes = container[day] || {};
  const dayMenu = getMealMenu('lunch', week, day);
  const slots = [
    { key: 'soup', label: 'Soup' },
    { key: 'salad', label: 'Salad' },
    { key: 'saladDressing', label: 'Salad Dressing / Vinaigrette' },
    { key: 'main1', label: 'Main 1' },
    { key: 'main2', label: 'Main 2' },
    { key: 'dessert', label: 'Dessert' }
  ];

  return slots
    .map(slot => {
      const resolved = resolveLunchRecipeForSlot({ week, day, slot, dayRecipes, dayMenu });
      return `<article><h2>${slot.label}</h2>${renderLunchRecipeCard(resolved.recipe, resolved.expectedTitle, resolved.context)}</article>`;
    })
    .join('');
}

function renderRecipe() {
  const recipeDetails = document.getElementById('recipeDetails');
  if (!recipeDetails) return;

  const weekSelect = document.getElementById('weekSelect');
  const week = weekSelect.value;
  const day = document.getElementById('daySelect').value;

  if (selectedMeal === 'lunch') {
    recipeDetails.innerHTML = renderLunchRecipesByDay(week, day);
    return;
  }

  if (!selectedDish || /^(add alternative|n\/a)$/i.test(selectedDish)) {
    recipeDetails.innerHTML = '<p>Select a dish to view its recipe.</p>';
    return;
  }

  const weekRecipes = recipesStore && recipesStore[week];
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
  if (selectedMeal === 'lunch') return;
  const dishName = elem.dataset.dish;
  if (!dishName || /^(add alternative|n\/a)$/i.test(dishName)) return;

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
    if (meal === 'dinner') {
      itemBlock.addEventListener('click', () => handleDishClick(itemBlock));
    }
    menuRow.appendChild(itemBlock);
  });

  if (meal !== 'dinner') {
    renderRecipe();
    return;
  }

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
    msg.textContent = 'Lunch ingredients checker coming next — we’ll add recipes first.';
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
    const filtered = (entry.categories[groupName] || []).filter(item => item.name.toLowerCase().includes(searchTerm));
    if (filtered.length === 0) continue;

    hasResults = true;
    const section = document.createElement('section');
    const header = document.createElement('h3');
    header.textContent = groupName.charAt(0).toUpperCase() + groupName.slice(1);
    section.appendChild(header);

    const ul = document.createElement('ul');
    filtered.forEach(item => {
      const li = document.createElement('li');
      const quantityStr = item.quantity ? `${item.quantity} ${item.unit || ''}`.trim() : '';
      li.textContent = quantityStr ? `${quantityStr} — ${item.name}` : item.name;
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
  const recipesView = document.getElementById('recipesView');
  const weeklyView = document.getElementById('weeklyView');
  const mobileMode = tab === 'ingredients' ? 'ingredients' : 'recipes';

  recipesView.dataset.mobileView = mobileMode;

  if (tab === 'recipes') {
    recipeTab.classList.add('active');
    ingredientTab.classList.remove('active');
    weeklyTab.classList.remove('active');
    recipesView.classList.add('active');
    weeklyView.classList.remove('active');
    setDaySelectorVisibility(true);
  } else if (tab === 'ingredients') {
    recipeTab.classList.remove('active');
    ingredientTab.classList.add('active');
    weeklyTab.classList.remove('active');
    recipesView.classList.add('active');
    weeklyView.classList.remove('active');
    setDaySelectorVisibility(true);
  } else {
    recipeTab.classList.remove('active');
    ingredientTab.classList.remove('active');
    weeklyTab.classList.add('active');
    recipesView.classList.remove('active');
    weeklyView.classList.add('active');
    setDaySelectorVisibility(false);
    renderWeeklyView(document.getElementById('weekSelect').value);
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
  const dinnerMealTab = document.getElementById('dinnerMealTab');
  const lunchMealTab = document.getElementById('lunchMealTab');

  weekSelect.addEventListener('change', () => {
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
  dinnerMealTab.addEventListener('click', () => setMeal('dinner'));
  lunchMealTab.addEventListener('click', () => setMeal('lunch'));
}

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Initialization failed: required element #${id} was not found.`);
  }
  return element;
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
    'dinnerMealTab',
    'lunchMealTab',
    'recipesView',
    'weeklyView',
    'weeklyMenuGrid'
  ].forEach(requireElement);
}

function init() {
  validateRequiredSelectors();

  if (!mealData.dinner || !Object.keys(mealData.dinner).length) {
    console.warn('Dinner menu data failed to load; week/day dropdowns cannot be populated.');
    return;
  }

  if (!mealData.lunch || !Object.keys(mealData.lunch).length) {
    console.warn('Lunch menu data failed to load; lunch view may not render menu cards.');
  }

  populateWeeks(selectedMeal);
  populateDays();

  try {
    buildIngredientCheckerData();
  } catch (error) {
    console.warn('Failed to build ingredient checker data:', error);
  }

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
