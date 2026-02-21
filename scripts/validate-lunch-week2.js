#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScriptIntoContext(ctx, relativePath) {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  vm.runInContext(code, ctx, { filename: relativePath });
}

function normalizeTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const context = vm.createContext({ console, globalThis: {} });

loadScriptIntoContext(context, 'menu_overview.js');
loadScriptIntoContext(context, 'dinner_menu_data.js');
loadScriptIntoContext(context, 'lunch_menu_data.js');
loadScriptIntoContext(context, 'recipeslunch.js');

const lunchMenuData = context.globalThis.lunchMenuData;
const lunchRecipes = context.globalThis.recipesLunchData;
const dinnerMenuData = context.globalThis.dinnerMenuData;

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

  const expected = {
    SOUP: menuDay['SOUP'],
    SALAD: menuDay['SALAD'],
    'MAIN 1': menuDay['MAIN 1'],
    'MAIN 2': menuDay['MAIN 2'],
    DESSERT: menuDay['DESSERT']
  };

  for (const [slot, menuTitle] of Object.entries(expected)) {
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
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}

console.log('Validation passed: Week 2 lunch recipes are complete, mapped to menu items, and unique across lunch/dinner titles.');
