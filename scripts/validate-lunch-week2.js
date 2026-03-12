#!/usr/bin/env node

const { readMenuJson, readRecipesJson } = require('./dataStore');

function normalizeTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const menu = readMenuJson();
const recipes = readRecipesJson();
const lunchMenuData = menu.lunch || {};
const lunchRecipes = recipes.lunch || {};
const dinnerMenuData = menu.dinner || {};

const weekKey = '2';
const weekMenuKey = 'Week 2';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const errors = [];

for (const day of days) {
  const menuDay = lunchMenuData?.[weekMenuKey]?.[day];
  const recipeWeek = lunchRecipes?.[weekKey];
  if (!menuDay) errors.push(`Missing lunch menu for ${day}.`);
  if (!recipeWeek) errors.push(`Missing lunch recipes for week ${weekKey}.`);
  if (!menuDay || !recipeWeek) continue;

  for (const slot of ['SOUP', 'SALAD', 'MAIN 1', 'MAIN 2', 'DESSERT']) {
    const menuTitle = menuDay[slot];
    if (!menuTitle) continue;
    const recipeHtml = recipeWeek[menuTitle];
    if (!recipeHtml) {
      errors.push(`${day} missing recipe for slot ${slot}: '${menuTitle}'.`);
      continue;
    }
    if (normalizeTitle(recipeHtml).includes('recipe not added yet')) {
      errors.push(`${day} ${slot} contains placeholder recipe content: '${menuTitle}'.`);
    }
  }
}

const lunchTitles = new Set();
for (const day of days) {
  const menuDay = lunchMenuData?.[weekMenuKey]?.[day] || {};
  ['SOUP', 'SALAD', 'MAIN 1', 'MAIN 2', 'DESSERT'].forEach((key) => {
    if (menuDay[key]) lunchTitles.add(normalizeTitle(menuDay[key]));
  });
}

const duplicateCrossMealTitles = [];
Object.values(dinnerMenuData || {}).forEach((week) => {
  Object.values(week || {}).forEach((dayMenu) => {
    Object.values(dayMenu || {}).forEach((title) => {
      const normalized = normalizeTitle(title);
      if (lunchTitles.has(normalized)) duplicateCrossMealTitles.push(title);
    });
  });
});

if (duplicateCrossMealTitles.length) {
  errors.push(`Duplicate lunch/dinner titles found: ${[...new Set(duplicateCrossMealTitles)].join(', ')}`);
}

if (errors.length) {
  console.error('Validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Validation passed: Week 2 lunch recipes are complete, mapped to menu items, and unique across lunch/dinner titles.');
