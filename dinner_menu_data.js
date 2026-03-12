// Compatibility shim. Source of truth now lives in data/menu.json.
let dinnerMenuData = globalThis.dinnerMenuData || globalThis.menuOverviewData || {};

if (typeof module !== 'undefined' && module.exports) {
  const fs = require('fs');
  const path = require('path');
  const menuData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'menu.json'), 'utf8').replace(/^\uFEFF/, '')
  );
  dinnerMenuData = menuData.dinner || {};
  module.exports = { dinnerMenuData };
}

if (typeof globalThis !== 'undefined') {
  globalThis.dinnerMenuData = dinnerMenuData;
}
