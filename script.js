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
    const common = targetWords.filter(word => keyWords.includes(word));
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
  document.querySelectorAll('.menu-item-block').forEach(block => {
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
  for (const week in menuOverviewData) {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = 'week'+week;
    weekSelect.appendChild(option);
  }
}

/**
 * Populate the day select dropdown based on the selected week.
 */
function populateDays() {
  const weekSelect = document.getElementById('weekSelect');
  const daySelect = document.getElementById('daySelect');
  daySelect.innerHTML = '';
  const week = weekSelect.value;
  const days = menuOverviewData[week] ? Object.keys(menuOverviewData[week]) : [];
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
  for (const block of blocks) {
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
  populateWeeks();
  populateDays();
  renderMenuRow();
  renderIngredients();
  attachEvents();
  // Set default to recipe tab and hide search controls initially
  switchTab('recipes');
});