// Chef Dashboard Script

// Titles for the menu categories in order of appearance
const categoryTitles = [
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

// Currently selected dish name (displayed in recipe view)
let selectedDish = null;

const ingredientCategories = ['produce', 'protein', 'dairy', 'dry', 'other'];
const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Normalize dish names by removing punctuation, parenthetical notes, and converting to lowercase.
 * This helps match menu entries to recipe keys in recipesData.
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  if (!name) return '';
  // Remove text in parentheses
  let cleaned = name.replace(/\([^)]*\)/g, '');
  // Replace hyphens and commas with space
  cleaned = cleaned.replace(/[-,]/g, ' ');
  // Replace HTML entity for ampersand
  cleaned = cleaned.replace(/&amp;/g, 'and');
  // Remove filler words like 'with' and 'and'
  cleaned = cleaned.replace(/\bwith\b/gi, ' ');
  cleaned = cleaned.replace(/\band\b/gi, ' ');
  // Collapse multiple spaces and trim
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
    if (count === 0) {
      emptyWeeks.push(week);
    }
    totalIngredients += count;
  });

  if (totalIngredients === 0) {
    throw new Error('Ingredient checker has no ingredients loaded.');
  }

  if (emptyWeeks.length > 0) {
    console.warn(`Ingredient checker has no generated ingredients for week(s): ${emptyWeeks.join(', ')}.`);
  }
}

/**
 * Render the detailed recipe for the currently selected dish.
 * If a matching recipe is found in recipesData for the selected week, display it.
 * Otherwise, show a message indicating the recipe isn't available.
 */
function renderRecipe() {
  const recipeDetails = document.getElementById('recipeDetails');
  // Only render recipes when in the recipes tab
  if (!recipeDetails) return;
  const weekSelect = document.getElementById('weekSelect');
  const week = weekSelect.value;
  // If no dish selected or placeholder, clear and return
  if (!selectedDish || selectedDish === 'Add alternative') {
    recipeDetails.innerHTML = '<p>Select a dish to view its recipe.</p>';
    return;
  }
  // Access recipes for the selected week
  const weekRecipes = recipesData && recipesData[week];
  if (!weekRecipes) {
    recipeDetails.innerHTML = '<p>Recipe data not available for this week.</p>';
    return;
  }
  const target = normalizeName(selectedDish);
  let bestKey = null;
  let bestScore = 0;
  // Iterate through recipes to find best match based on normalized word overlap
  for (const recipeName in weekRecipes) {
    if (!Object.prototype.hasOwnProperty.call(weekRecipes, recipeName)) continue;
    const normKey = normalizeName(recipeName);
    // Exact match
    if (normKey === target) {
      bestKey = recipeName;
      bestScore = 1;
      break;
    }
    // Compute overlap score based on common words
    const keyWords = normKey.split(' ').filter(w => w.length > 0);
    const targetWords = target.split(' ').filter(w => w.length > 0);
    if (keyWords.length === 0 || targetWords.length === 0) continue;
    const common = targetWords.filter(word => keyWords.indexOf(word) !== -1);
    const score = common.length / Math.min(keyWords.length, targetWords.length);
    if (score > bestScore) {
      bestScore = score;
      bestKey = recipeName;
    }
  }
  if (bestKey && bestScore >= 0.4) {
    recipeDetails.innerHTML = weekRecipes[bestKey];
  } else {
    recipeDetails.innerHTML = '<p>Recipe not available for the selected dish.</p>';
  }
}

/**
 * Handle click on a menu item block.
 * Sets the selected dish and highlights the clicked block.
 * @param {HTMLElement} elem
 */
function handleDishClick(elem) {
  const dishName = elem.dataset.dish;
  if (!dishName || dishName === 'Add alternative') {
    return;
  }
  selectedDish = dishName;
  // Remove selected class from all blocks
  const blocks = document.querySelectorAll('.menu-item-block');
  Array.prototype.forEach.call(blocks, block => {
    block.classList.remove('selected');
  });
  // Add selected class to clicked block
  elem.classList.add('selected');
  // Render the recipe details
  renderRecipe();
}

/**
 * Populate the week select dropdown with available weeks from menuOverviewData.
 */
function populateWeeks() {
  const weekSelect = document.getElementById('weekSelect');
  weekSelect.innerHTML = '';
  // Extract available week keys from menuOverviewData
  Object.keys(menuOverviewData)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(week => {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = `Week ${week}`;
    weekSelect.appendChild(option);
    });
}

/**
 * Populate the day select dropdown based on the selected week.
 */
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

/**
 * Render the menu row for the current week and day.
 */
function renderMenuRow() {
  const weekSelect = document.getElementById('weekSelect');
  const daySelect = document.getElementById('daySelect');
  const menuRow = document.getElementById('menuRow');
  menuRow.innerHTML = '';
  const week = weekSelect.value;
  const day = daySelect.value;
  const dayData = menuOverviewData[week] && menuOverviewData[week][day];
  // Reset selected dish when rendering new day
  selectedDish = null;
  categoryTitles.forEach(cat => {
    const itemBlock = document.createElement('div');
    itemBlock.className = 'menu-item-block';
    const label = document.createElement('div');
    label.className = 'category-label';
    label.textContent = cat;
    const dish = document.createElement('div');
    dish.className = 'dish-name';
    let dishText = 'Add alternative';
    if (dayData && typeof dayData[cat] !== 'undefined' && dayData[cat] !== null) {
      dishText = dayData[cat];
    }
    dish.textContent = dishText;
    // Store dish name for click handling
    itemBlock.dataset.dish = dishText;
    itemBlock.appendChild(label);
    itemBlock.appendChild(dish);
    // Attach click listener to each block for recipe display
    itemBlock.addEventListener('click', () => {
      handleDishClick(itemBlock);
    });
    menuRow.appendChild(itemBlock);
  });
  // Automatically select the first available dish
  const blocks = document.querySelectorAll('.menu-item-block');
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.dataset.dish && block.dataset.dish !== 'Add alternative') {
      handleDishClick(block);
      break;
    }
  }
}

/**
 * Render the ingredients list for the current week and day.
 * Ingredients are grouped by their category (e.g., produce, protein).
 */
function renderIngredients() {
  const weekSelect = document.getElementById('weekSelect');
  const daySelect = document.getElementById('daySelect');
  const searchInput = document.getElementById('searchInput');
  const ingredientsContainer = document.getElementById('ingredientsContainer');
  ingredientsContainer.innerHTML = '';
  const week = parseInt(weekSelect.value);
  const day = daySelect.value;
  // Find the corresponding entry in menuData.menu
  const entry = menuData.menu.find(item => item.week === week && item.day === day);
  if (!entry || !entry.categories) {
    // If no entry found, show a message
    const msg = document.createElement('p');
    msg.textContent = 'No ingredients available for this day.';
    ingredientsContainer.appendChild(msg);
    return;
  }
  const searchTerm = searchInput.value.trim().toLowerCase();
  let hasResults = false;
  // Iterate over each ingredient category
  for (const groupName in entry.categories) {
    // Skip categories not recognized (safety check)
    if (!Object.prototype.hasOwnProperty.call(entry.categories, groupName)) continue;
    const items = entry.categories[groupName];
    // Filter items based on search term
    const filtered = items.filter(item => {
      return item.name.toLowerCase().includes(searchTerm);
    });
    if (filtered.length > 0) {
      hasResults = true;
      const section = document.createElement('section');
      const header = document.createElement('h3');
      // Capitalize the group name for display
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
  }
  // If no results after filtering, show a message
  if (!hasResults) {
    const p = document.createElement('p');
    p.className = 'no-results';
    p.textContent = 'No ingredients match your search.';
    ingredientsContainer.appendChild(p);
  }
}

/**
 * Switch between recipe and ingredients views.
 * @param {string} tab Either 'recipes' or 'ingredients'
 */
function switchTab(tab) {
  const recipeTab = document.getElementById('recipeTab');
  const ingredientTab = document.getElementById('ingredientTab');
  const recipesView = document.getElementById('recipesView');
  const ingredientsView = document.getElementById('ingredientsView');
  const searchLabel = document.getElementById('searchLabel');
  const searchInput = document.getElementById('searchInput');
  if (tab === 'recipes') {
    recipeTab.classList.add('active');
    ingredientTab.classList.remove('active');
    recipesView.classList.add('active');
    ingredientsView.classList.remove('active');
    // Hide search controls when not on ingredients tab
    searchLabel.style.display = 'none';
    searchInput.style.display = 'none';
  } else {
    recipeTab.classList.remove('active');
    ingredientTab.classList.add('active');
    recipesView.classList.remove('active');
    ingredientsView.classList.add('active');
    // Show search controls when on ingredients tab
    searchLabel.style.display = '';
    searchInput.style.display = '';
  }
}

/**
 * Attach event listeners to controls and tabs.
 */
function attachEvents() {
  const weekSelect = document.getElementById('weekSelect');
  const daySelect = document.getElementById('daySelect');
  const searchInput = document.getElementById('searchInput');
  const recipeTab = document.getElementById('recipeTab');
  const ingredientTab = document.getElementById('ingredientTab');
  weekSelect.addEventListener('change', () => {
    populateDays();
    renderMenuRow();
    renderIngredients();
  });
  daySelect.addEventListener('change', () => {
    renderMenuRow();
    renderIngredients();
  });
  searchInput.addEventListener('input', () => {
    renderIngredients();
  });
  recipeTab.addEventListener('click', () => {
    switchTab('recipes');
  });
  ingredientTab.addEventListener('click', () => {
    switchTab('ingredients');
  });
}

// Initialize the dashboard once the DOM is ready
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

  renderMenuRow();
  renderIngredients();
  attachEvents();
  // Set default to recipe tab and hide search controls initially
  switchTab('recipes');
});
