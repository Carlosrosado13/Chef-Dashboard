#!/usr/bin/env node

const { readRecipesJson, DINNER_RECIPES_JSON_PATH, LUNCH_RECIPES_JSON_PATH } = require('./loadRecipesJson');
const { validateRecipeDataset } = require('./recipeValidation');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function main() {
  try {
    const recipes = readRecipesJson();
    validateRecipeDataset('Dinner recipes', recipes.dinner);
    validateRecipeDataset('Lunch recipes', recipes.lunch);
    console.log(`validate:recipes OK (${DINNER_RECIPES_JSON_PATH}, ${LUNCH_RECIPES_JSON_PATH})`);
  } catch (error) {
    fail(error.message || String(error));
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main();
