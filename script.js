// Chef Dashboard Script

const dinnerCategoryTitles = [
  'Appetizer 1',
  'Appetizer 2',
  'Elevated',
  'Traditional',
  'Alternative',
  'Veg 1',
  'Veg 2',
  'Starch',
  'Dessert'
];

const lunchCategoryConfig = [
  { key: 'SOUP', label: 'Soup' },
  { key: 'MAIN 1', label: 'Main 1' },
  { key: 'MAIN 2', label: 'Main 2' },
  { key: 'SALAD', label: 'Side (Salad)' },
  { key: 'DESSERT', label: 'Dessert' }
];

let selectedDish = null;
let currentMeal = 'dinner';

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
  if (!menuData || !Array.isArray(menuData.menu)) return lookup;
  menuData.menu.forEach(entry => {
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
  if (!menuOverviewData || !recipesData) return;
  const categoryLookup = buildCategoryLookup();
  const generatedMenu = [];

  Object.keys(menuOverviewData).forEach(weekKey => {
    const weekNumber = Number(weekKey);
    const weekDays = menuOverviewData[weekKey];
    Object.keys(weekDays).forEach(day => {
      const categories = { produce: [], protein: [], dairy: [], dry: [], other: [] };
      const seenByCategory = { produce: new Set(), protein: new Set(), dairy: new Set(), dry: new Set(), other: new Set() };
      const dayMenu = weekDays[day];
      const weekRecipes = recipesData[weekKey] || {};

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

  menuData.menu = generatedMenu;
  validateIngredientCheckerData();
}

function validateIngredientCheckerData() {
  const weeks = new Set(menuData.menu.map(entry => entry.week));
  let totalIngredients = 0;
  const emptyWeeks = [];

  weeks.forEach(week => {
    const weekEntries = menuData.menu.filter(entry => entry.week === week);
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

function renderRecipe() {
  const recipeDetails = document.getElementById('recipeDetails');
  if (!recipeDetails) return;

  if (currentMeal === 'lunch') {
    recipeDetails.innerHTML = '<p>Lunch recipes are coming next — for now this view shows menu items only.</p>';
    return;
  }

  const weekSelect = document.getElementById('weekSelect');
  const week = weekSelect.value;

  if (!selectedDish || selectedDish === 'Add alternative') {
    recipeDetails.innerHTML = '<p>Select a dish to view its recipe.</p>';
    return;
  }

  const weekRecipes = recipesData && recipesData[week];
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
  if (currentMeal === 'lunch') return;
  const dishName = elem.dataset.dish;
  if (!dishName || dishName === 'Add alternative') return;

  selectedDish = dishName;
  const blocks = document.querySelectorAll('.menu-item-block');
  Array.prototype.forEach.call(blocks, block => block.classList.remove('selected'));
  elem.classList.add('selected');
  renderRecipe();
}

function populateWeeks() {
  const weekSelect = document.getElementById('weekSelect');
  weekSelect.innerHTML = '';
  Object.keys(menuOverviewData)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(week => {
      const option = document.createElement('option');
      option.value = week;
      option.textContent = `Week ${week}`;
      weekSelect.appendChild(option);
    });
}

function populateDays() {
  const weekSelect = document.getElementById('weekSelect');
  const daySelect = document.getElementById('daySelect');
  daySelect.innerHTML = '';
  const week = weekSelect.value;
  const weekData = menuOverviewData[week] || {};
  const days = dayOrder.filter(day => Object.prototype.hasOwnProperty.call(weekData, day));
  days.forEach(day => {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = day;
    daySelect.appendChild(option);
  });
}

function getMenuFor(weekKey, dayName) {
  const weekData = menuOverviewData && menuOverviewData[weekKey];
  if (!weekData) return {};

  const aliases = WEEKLY_DAY_KEYS[dayName] || [dayName];
  for (let i = 0; i < aliases.length; i += 1) {
    const alias = aliases[i];
    if (Object.prototype.hasOwnProperty.call(weekData, alias)) return weekData[alias] || {};
  }
  return {};
}

function getLunchMenu(weekKey, dayName) {
  if (!lunchMenuData) return {};

  const normalizedWeek = /^Week\s+\d+$/i.test(weekKey) ? weekKey : `Week ${weekKey}`;
  const weekData = lunchMenuData[normalizedWeek];
  if (!weekData) return {};

  const aliases = WEEKLY_DAY_KEYS[dayName] || [dayName];
  for (let i = 0; i < aliases.length; i += 1) {
    const alias = aliases[i];
    if (Object.prototype.hasOwnProperty.call(weekData, alias)) return weekData[alias] || {};
  }

  return {};
}

function renderLunchDay(weekKey, dayName) {
  const menuRow = document.getElementById('menuRow');
  const lunchDay = getLunchMenu(weekKey, dayName);
  menuRow.innerHTML = '';

  selectedDish = null;
  lunchCategoryConfig.forEach(category => {
    const itemBlock = document.createElement('div');
    itemBlock.className = 'menu-item-block';

    const label = document.createElement('div');
    label.className = 'category-label';
    label.textContent = category.label;

    const dish = document.createElement('div');
    dish.className = 'dish-name';
    dish.textContent = lunchDay[category.key] || 'Menu item not set';

    itemBlock.appendChild(label);
    itemBlock.appendChild(dish);
    menuRow.appendChild(itemBlock);
  });

  renderRecipe();
}

function renderMenuRow() {
  const week = document.getElementById('weekSelect').value;
  const day = document.getElementById('daySelect').value;

  if (currentMeal === 'lunch') {
    renderLunchDay(week, day);
    return;
  }

  const menuRow = document.getElementById('menuRow');
  menuRow.innerHTML = '';
  const dayData = menuOverviewData[week] && menuOverviewData[week][day];
  selectedDish = null;

  dinnerCategoryTitles.forEach(cat => {
    const itemBlock = document.createElement('div');
    itemBlock.className = 'menu-item-block';

    const label = document.createElement('div');
    label.className = 'category-label';
    label.textContent = cat;

    const dish = document.createElement('div');
    dish.className = 'dish-name';
    const dishText = dayData && typeof dayData[cat] !== 'undefined' && dayData[cat] !== null
      ? dayData[cat]
      : 'Add alternative';
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
    if (block.dataset.dish && block.dataset.dish !== 'Add alternative') {
      handleDishClick(block);
      break;
    }
  }
}

function renderIngredients() {
  const ingredientsContainer = document.getElementById('ingredientsContainer');
  ingredientsContainer.innerHTML = '';

  if (currentMeal === 'lunch') {
    const msg = document.createElement('p');
    msg.className = 'no-results';
    msg.textContent = 'Lunch ingredients checker coming next — we’ll add recipes first.';
    ingredientsContainer.appendChild(msg);
    return;
  }

  const week = Number(document.getElementById('weekSelect').value);
  const day = document.getElementById('daySelect').value;
  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  const entry = menuData.menu.find(item => item.week === week && item.day === day);

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

function renderLunchWeek(weekKey) {
  const weeklyMenuGrid = document.getElementById('weeklyMenuGrid');
  weeklyMenuGrid.innerHTML = '';

  dayOrder.forEach(day => {
    const dayData = getLunchMenu(weekKey, day);
    const dayCard = document.createElement('section');
    dayCard.className = 'day-card';

    const title = document.createElement('h2');
    title.className = 'day-card-title';
    title.textContent = day;
    dayCard.appendChild(title);

    const slots = document.createElement('div');
    slots.className = 'day-card-slots';
    lunchCategoryConfig.forEach(category => {
      const slot = document.createElement('div');
      slot.className = 'day-card-slot';

      const label = document.createElement('div');
      label.className = 'day-card-slot-label';
      label.textContent = category.label;

      const value = document.createElement('div');
      value.className = 'day-card-slot-value';
      value.textContent = dayData[category.key] || 'Menu item not set';

      slot.appendChild(label);
      slot.appendChild(value);
      slots.appendChild(slot);
    });

    dayCard.appendChild(slots);
    weeklyMenuGrid.appendChild(dayCard);
  });
}

function renderWeeklyView(weekId) {
  const weeklyMenuGrid = document.getElementById('weeklyMenuGrid');
  if (!weeklyMenuGrid) return;

  const week = weekId || document.getElementById('weekSelect').value;
  if (currentMeal === 'lunch') {
    renderLunchWeek(week);
    return;
  }

  weeklyMenuGrid.innerHTML = '';
  dayOrder.forEach(day => {
    const dayData = getMenuFor(week, day);
    const dayCard = document.createElement('section');
    dayCard.className = 'day-card';

    const title = document.createElement('h2');
    title.className = 'day-card-title';
    title.textContent = day;
    dayCard.appendChild(title);

    const slots = document.createElement('div');
    slots.className = 'day-card-slots';
    dinnerCategoryTitles.forEach(category => {
      const slot = document.createElement('div');
      slot.className = 'day-card-slot';

      const label = document.createElement('div');
      label.className = 'day-card-slot-label';
      label.textContent = category;

      const value = document.createElement('div');
      value.className = 'day-card-slot-value';
      value.textContent = dayData[category] || 'Add alternative';

      slot.appendChild(label);
      slot.appendChild(value);
      slots.appendChild(slot);
    });

    dayCard.appendChild(slots);
    weeklyMenuGrid.appendChild(dayCard);
  });
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
  currentMeal = meal;
  const dinnerMealTab = document.getElementById('dinnerMealTab');
  const lunchMealTab = document.getElementById('lunchMealTab');

  dinnerMealTab.classList.toggle('active', meal === 'dinner');
  lunchMealTab.classList.toggle('active', meal === 'lunch');
  document.body.classList.toggle('lunch-mode', meal === 'lunch');

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

document.addEventListener('DOMContentLoaded', () => {
  if (!menuOverviewData || !Object.keys(menuOverviewData).length) {
    console.error('Menu overview data failed to load; week/day dropdowns cannot be populated.');
    return;
  }

  populateWeeks();
  populateDays();

  try {
    buildIngredientCheckerData();
  } catch (error) {
    console.error('Failed to build ingredient checker data:', error);
  }

  setMeal('dinner');
  renderWeeklyView(document.getElementById('weekSelect').value);
  attachEvents();
  switchTab('recipes');
});
