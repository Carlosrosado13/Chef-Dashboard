#!/usr/bin/env node

const { readRecipesJson } = require('./loadRecipesJson');

function assertWeekShape(label, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label}: data missing or invalid`);
  }

  const availableWeeks = Object.keys(data).filter((key) => /^\d+$/.test(String(key)));
  if (!availableWeeks.length) {
    throw new Error(`${label}: no numeric week keys found`);
  }

  const missing = [];
  for (let week = 1; week <= 4; week += 1) {
    if (!Object.prototype.hasOwnProperty.call(data, String(week)) && !Object.prototype.hasOwnProperty.call(data, week)) {
      missing.push(week);
    }
  }
  if (missing.length) {
    console.warn(`WARN: ${label} missing week(s): ${missing.join(', ')}`);
  }

  availableWeeks.forEach((week) => {
    const weekData = data[week];
    if (!weekData || typeof weekData !== 'object' || Array.isArray(weekData)) {
      throw new Error(`${label}: week ${week} invalid`);
    }
    if (!Object.keys(weekData).length) {
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
