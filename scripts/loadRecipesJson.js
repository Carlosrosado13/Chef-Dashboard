const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const RECIPES_JSON_PATH = path.join(ROOT_DIR, 'frontend', 'data', 'recipes.json');

function readRecipesJson() {
  const source = fs.readFileSync(RECIPES_JSON_PATH, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(source);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('frontend/data/recipes.json must contain an object');
  }

  return {
    all: parsed,
    dinner: parsed.dinner && typeof parsed.dinner === 'object' && !Array.isArray(parsed.dinner) ? parsed.dinner : {},
    lunch: parsed.lunch && typeof parsed.lunch === 'object' && !Array.isArray(parsed.lunch) ? parsed.lunch : {},
  };
}

module.exports = {
  RECIPES_JSON_PATH,
  readRecipesJson,
};
