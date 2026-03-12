#!/usr/bin/env node

const { readRecipesJson } = require('./loadRecipesJson');

function assertWeekShape(label, data) {
  if (!Array.isArray(data)) {
    throw new Error(`${label}: data missing or invalid`);
  }

  const availableWeeks = Array.from(new Set(data.map((recipe) => String(recipe.week)).filter((week) => /^\d+$/.test(week))));
  if (!availableWeeks.length) {
    throw new Error(`${label}: no numeric week keys found`);
  }

  const missing = [];
  for (let week = 1; week <= 4; week += 1) {
    if (!availableWeeks.includes(String(week))) {
      missing.push(week);
    }
  }
  if (missing.length) {
    console.warn(`WARN: ${label} missing week(s): ${missing.join(', ')}`);
  }

  availableWeeks.forEach((week) => {
    const weekData = data.filter((recipe) => String(recipe.week) === String(week));
    if (!weekData.length) {
      throw new Error(`${label}: week ${week} has no entries`);
    }
  });
}

function main() {
  const recipes = readRecipesJson();
  assertWeekShape('Dinner', recipes.dinner);
  assertWeekShape('Lunch', recipes.lunch);
  console.log('smoke:recipes OK');
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message || String(error)}`);
  process.exit(1);
}
