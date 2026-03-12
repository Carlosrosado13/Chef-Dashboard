const fs = require('fs');
const path = require('path');
const { normalizeStoredRecipeHtml } = require('./recipeValidation');
const { migrateRecipeCollection, groupRecipesByWeek, stripHtml } = require('./recipeSchema');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DINNER_RECIPES_JSON_PATH = path.join(DATA_DIR, 'recipes.json');
const LUNCH_RECIPES_JSON_PATH = path.join(DATA_DIR, 'recipes_lunch.json');
const MENU_JSON_PATH = path.join(DATA_DIR, 'menu.json');
const INGREDIENTS_JSON_PATH = path.join(DATA_DIR, 'ingredients.json');

const ingredientCategories = ['produce', 'protein', 'dairy', 'dry', 'other'];

function readJsonFile(filePath, label) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(source);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${label} must contain valid JSON`);
  }
  return parsed;
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readRecipesJson() {
  const dinnerRaw = readJsonFile(DINNER_RECIPES_JSON_PATH, 'data/recipes.json');
  const lunchRaw = readJsonFile(LUNCH_RECIPES_JSON_PATH, 'data/recipes_lunch.json');
  const dinnerList = migrateRecipeCollection('dinner', dinnerRaw);
  const lunchList = migrateRecipeCollection('lunch', lunchRaw);
  return {
    all: { dinner: dinnerList, lunch: lunchList },
    dinner: dinnerList,
    lunch: lunchList,
    dinnerByWeek: groupRecipesByWeek(dinnerList),
    lunchByWeek: groupRecipesByWeek(lunchList),
  };
}

function readMenuJson() {
  return readJsonFile(MENU_JSON_PATH, 'data/menu.json');
}

function writeMenuJson(data) {
  writeJsonFile(MENU_JSON_PATH, data);
}

function readIngredientsJson() {
  return readJsonFile(INGREDIENTS_JSON_PATH, 'data/ingredients.json');
}

function writeIngredientsJson(data) {
  writeJsonFile(INGREDIENTS_JSON_PATH, data);
}

function normalizeName(value) {
  return stripHtml(value).toLowerCase();
}

function asIngredientLine(value) {
  return stripHtml(value).replace(/\s+/g, ' ').trim();
}

function parseQuantityAndUnit(value) {
  const cleaned = stripHtml(value).replace(/,/g, '.');
  if (!cleaned) return { quantity: null, unit: '' };

  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { quantity: null, unit: cleaned };

  return {
    quantity: Number(match[1]),
    unit: String(match[2] || '').trim(),
  };
}

function parseIngredientsFromRecipeHtml(recipeHtml) {
  const rows = [];
  if (!recipeHtml || typeof recipeHtml !== 'string') return rows;

  const trMatches = recipeHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  trMatches.forEach((row) => {
    const tdMatches = row.match(/<td[\s\S]*?<\/td>/gi) || [];
    if (tdMatches.length < 2) return;
    const ingredientName = asIngredientLine(tdMatches[0]);
    if (!ingredientName || /^ingredient$/i.test(ingredientName)) return;
    const amount = parseQuantityAndUnit(tdMatches[1]);
    rows.push({ name: ingredientName, quantity: amount.quantity, unit: amount.unit });
  });

  return rows;
}

function buildCategoryLookup(currentIngredientMenu) {
  const lookup = {};
  const menuEntries = Array.isArray(currentIngredientMenu) ? currentIngredientMenu : [];

  menuEntries.forEach((entry) => {
    if (!entry || !entry.categories) return;
    ingredientCategories.forEach((category) => {
      const items = Array.isArray(entry.categories[category]) ? entry.categories[category] : [];
      items.forEach((item) => {
        const name = item && typeof item === 'object' ? item.name : item;
        const key = normalizeName(name);
        if (key && !lookup[key]) lookup[key] = category;
      });
    });
  });

  return lookup;
}

function findRecipeKey(weekRecipes, dishName) {
  if (!weekRecipes || typeof weekRecipes !== 'object') return '';
  const target = normalizeName(dishName);
  let bestKey = '';
  let bestScore = 0;

  Object.keys(weekRecipes).forEach((recipeName) => {
    const normKey = normalizeName(recipeName);
    if (normKey === target) {
      bestKey = recipeName;
      bestScore = 1;
      return;
    }

    const keyWords = normKey.split(' ').filter(Boolean);
    const targetWords = target.split(' ').filter(Boolean);
    if (!keyWords.length || !targetWords.length) return;

    const common = targetWords.filter((word) => keyWords.includes(word));
    const score = common.length / Math.min(keyWords.length, targetWords.length);
    if (score > bestScore) {
      bestScore = score;
      bestKey = recipeName;
    }
  });

  return bestScore >= 0.4 ? bestKey : '';
}

function buildDinnerIngredientMenu(dinnerMenuData, dinnerRecipes, currentIngredientMenu) {
  const categoryLookup = buildCategoryLookup(currentIngredientMenu);
  const generatedMenu = [];
  const recipesByWeek = Array.isArray(dinnerRecipes) ? groupRecipesByWeek(dinnerRecipes) : dinnerRecipes;

  Object.keys(dinnerMenuData || {}).forEach((weekKey) => {
    const weekNumber = Number(weekKey);
    const weekDays = dinnerMenuData[weekKey];
    if (!weekDays || typeof weekDays !== 'object') return;

    Object.keys(weekDays).forEach((day) => {
      const categories = { produce: [], protein: [], dairy: [], dry: [], other: [] };
      const seenByCategory = { produce: new Set(), protein: new Set(), dairy: new Set(), dry: new Set(), other: new Set() };
      const dayMenu = weekDays[day];
      const weekRecipes = recipesByWeek[weekKey] || {};

      Object.keys(dayMenu || {}).forEach((slotKey) => {
        const dishName = String(dayMenu[slotKey] || '').trim();
        if (!dishName || /^(n\/a|add alternative)$/i.test(dishName)) return;

        const recipeKey = findRecipeKey(weekRecipes, dishName);
        if (!recipeKey) return;

        const recipeHtml = normalizeStoredRecipeHtml(weekRecipes[recipeKey]);
        parseIngredientsFromRecipeHtml(recipeHtml).forEach((ingredient) => {
          const ingredientName = String(ingredient.name || '').trim();
          if (!ingredientName) return;

          const normalized = normalizeName(ingredientName);
          if (!normalized) return;

          const category = categoryLookup[normalized] || 'other';
          if (seenByCategory[category].has(normalized)) return;

          seenByCategory[category].add(normalized);
          categories[category].push({
            name: ingredientName,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        });
      });

      generatedMenu.push({ week: weekNumber, day, categories });
    });
  });

  return generatedMenu;
}

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  DINNER_RECIPES_JSON_PATH,
  LUNCH_RECIPES_JSON_PATH,
  MENU_JSON_PATH,
  INGREDIENTS_JSON_PATH,
  readJsonFile,
  writeJsonFile,
  readRecipesJson,
  groupRecipesByWeek,
  readMenuJson,
  writeMenuJson,
  readIngredientsJson,
  writeIngredientsJson,
  buildDinnerIngredientMenu,
};
