// Compatibility shim. Source of truth now lives in data/recipes.json.
let recipesData = globalThis.recipesData || {};

if (typeof module !== 'undefined' && module.exports) {
  const fs = require('fs');
  const path = require('path');
  recipesData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'recipes.json'), 'utf8').replace(/^\uFEFF/, '')
  );
  module.exports = { recipesData };
}

if (typeof globalThis !== 'undefined') {
  globalThis.recipesData = recipesData;
}
