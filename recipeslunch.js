// Compatibility shim. Source of truth now lives in data/recipes_lunch.json.
let recipesLunchData = globalThis.recipesLunchData || {};

if (typeof module !== 'undefined' && module.exports) {
  const fs = require('fs');
  const path = require('path');
  recipesLunchData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'recipes_lunch.json'), 'utf8').replace(/^\uFEFF/, '')
  );
  module.exports = { recipesLunchData };
}

if (typeof globalThis !== 'undefined') {
  globalThis.recipesLunchData = recipesLunchData;
}
