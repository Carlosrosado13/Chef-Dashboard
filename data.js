// Compatibility shim. Source of truth now lives in data/ingredients.json.
let menuData = globalThis.menuData || { menu: [] };

if (typeof module !== 'undefined' && module.exports) {
  const fs = require('fs');
  const path = require('path');
  const ingredientsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'ingredients.json'), 'utf8').replace(/^\uFEFF/, '')
  );
  menuData = { menu: Array.isArray(ingredientsData.menu) ? ingredientsData.menu : [] };
  module.exports = { menuData };
}

if (typeof globalThis !== 'undefined') {
  globalThis.menuData = menuData;
}
