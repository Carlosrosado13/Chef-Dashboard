#!/usr/bin/env node

const { readRecipesJson, RECIPES_JSON_PATH } = require('./loadRecipesJson');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateRecipeObject(label, data) {
  assert(data && typeof data === 'object' && !Array.isArray(data), `${label} must be an object`);
  const availableWeekKeys = Object.keys(data).filter((key) => /^\d+$/.test(String(key)));
  assert(availableWeekKeys.length > 0, `${label} must contain at least one numeric week key`);

  const missingWeeks = [];
  for (let week = 1; week <= 4; week += 1) {
    if (!Object.prototype.hasOwnProperty.call(data, String(week)) && !Object.prototype.hasOwnProperty.call(data, week)) {
      missingWeeks.push(week);
    }
  }
  if (missingWeeks.length) {
    console.warn(`WARN: ${label} is missing week(s): ${missingWeeks.join(', ')}`);
  }

  availableWeekKeys.forEach((weekKey) => {
    const weekData = data[weekKey];
    assert(weekData && typeof weekData === 'object' && !Array.isArray(weekData), `${label} week ${weekKey} must be an object`);

    const recipeKeys = Object.keys(weekData);
    assert(recipeKeys.length > 0, `${label} week ${weekKey} must have recipe entries`);
    assert(recipeKeys.some((key) => typeof weekData[key] === 'string'), `${label} week ${weekKey} must contain string recipe HTML entries`);
  });
}

function main() {
  try {
    const recipes = readRecipesJson();
    validateRecipeObject('Dinner recipes', recipes.dinner);
    validateRecipeObject('Lunch recipes', recipes.lunch);
    console.log(`validate:recipes OK (${RECIPES_JSON_PATH})`);
  } catch (error) {
    fail(error.message || String(error));
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main();
