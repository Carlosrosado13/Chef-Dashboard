// Compatibility shim. Source of truth now lives in data/menu.json.
let lunchMenuData = globalThis.lunchMenuData || {};

if (typeof module !== 'undefined' && module.exports) {
  const fs = require('fs');
  const path = require('path');
  const menuData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'menu.json'), 'utf8').replace(/^\uFEFF/, '')
  );
  lunchMenuData = menuData.lunch || {};
  module.exports = { lunchMenuData };
}

if (typeof globalThis !== 'undefined') {
  globalThis.lunchMenuData = lunchMenuData;
}
