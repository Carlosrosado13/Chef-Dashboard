#!/usr/bin/env node

const fs = require('fs');
const {
  DINNER_RECIPES_JSON_PATH,
  LUNCH_RECIPES_JSON_PATH,
  readJsonFile,
  writeJsonFile,
} = require('./dataStore');
const { migrateRecipeCollection } = require('./recipeSchema');

function migrateFile(filePath, menu) {
  const raw = readJsonFile(filePath, filePath);
  const migrated = migrateRecipeCollection(menu, raw);
  writeJsonFile(filePath, migrated);
  return migrated.length;
}

function main() {
  const dinnerCount = migrateFile(DINNER_RECIPES_JSON_PATH, 'dinner');
  const lunchCount = migrateFile(LUNCH_RECIPES_JSON_PATH, 'lunch');
  console.log(`Migrated dinner recipes: ${dinnerCount}`);
  console.log(`Migrated lunch recipes: ${lunchCount}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
