const {
  DINNER_RECIPES_JSON_PATH,
  LUNCH_RECIPES_JSON_PATH,
  readRecipesJson,
} = require('./dataStore');

module.exports = {
  DINNER_RECIPES_JSON_PATH,
  LUNCH_RECIPES_JSON_PATH,
  RECIPES_JSON_PATH: DINNER_RECIPES_JSON_PATH,
  readRecipesJson,
};
