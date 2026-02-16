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
loadScriptIntoContext(context, 'data/lunchRecipesWeek1.js');
loadScriptIntoContext(context, 'data/lunchRecipesWeek2.js');

const lunchMenuData = context.globalThis.lunchMenuData;
const lunchRecipes = context.globalThis.lunchRecipesWeek1;
const dinnerMenuData = context.globalThis.dinnerMenuData;

const weekKey = 'Week 2';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const errors = [];

for (const day of days) {
  const menuDay = lunchMenuData?.[weekKey]?.[day];
  const recipeDay = lunchRecipes?.[weekKey]?.[day];
  if (!menuDay) errors.push(`Missing lunch menu for ${day}.`);
  if (!recipeDay) errors.push(`Missing lunch recipes for ${day}.`);
  if (!menuDay || !recipeDay) continue;

  const expected = {
    soup: menuDay['SOUP'],
    salad: menuDay['SALAD'],
    main1: menuDay['MAIN 1'],
    main2: menuDay['MAIN 2'],
    dessert: menuDay['DESSERT']
  };

  for (const [slot, menuTitle] of Object.entries(expected)) {
    const recipe = recipeDay[slot];
    if (!recipe) {
      errors.push(`${day} missing recipe slot: ${slot}.`);
      continue;
    }
    if (!recipe.instructions || !String(recipe.instructions).trim()) {
      errors.push(`${day} ${slot} has empty instructions.`);
    }
    if (normalizeTitle(recipe.title) !== normalizeTitle(menuTitle)) {
      errors.push(`${day} ${slot} title mismatch. menu='${menuTitle}' recipe='${recipe.title}'.`);
    }
  }
}

const lunchTitles = new Set();
for (const day of days) {
  const menuDay = lunchMenuData?.[weekKey]?.[day] || {};
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
