#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DINNER_FILE = path.join(ROOT, 'recipes.js');
const LUNCH_FILE = path.join(ROOT, 'recipeslunch.js');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadInSandbox(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  const sandbox = vm.createContext(runtime);
  vm.runInContext(source, sandbox, { filename: path.basename(filePath) });
  return sandbox;
}

function validateRecipeObject(label, data) {
  assert(data && typeof data === 'object' && !Array.isArray(data), `${label} must be an object`);
  const weekKeys = Object.keys(data).filter((key) => Number.isFinite(Number(String(key).replace(/[^\d]/g, ''))));
  assert(weekKeys.length > 0, `${label} must contain numeric week keys`);

  for (const weekKey of weekKeys) {
    const weekData = data[weekKey];
    assert(weekData && typeof weekData === 'object' && !Array.isArray(weekData), `${label} week ${weekKey} must be an object`);
    const recipeKeys = Object.keys(weekData);
    assert(recipeKeys.length > 0, `${label} week ${weekKey} must have recipe entries`);

    let htmlCount = 0;
    for (const recipeName of recipeKeys) {
      const value = weekData[recipeName];
      assert(typeof value === 'string', `${label} week ${weekKey} recipe "${recipeName}" must be a string`);
      if (value.includes('<')) htmlCount += 1;
    }
    assert(htmlCount > 0, `${label} week ${weekKey} must include HTML recipe content`);
  }
}

function main() {
  try {
    const dinnerSandbox = loadInSandbox(DINNER_FILE);
    const lunchSandbox = loadInSandbox(LUNCH_FILE);

    const dinnerData = dinnerSandbox.recipesData;
    const lunchData = (lunchSandbox.module && lunchSandbox.module.exports && lunchSandbox.module.exports.recipesLunchData)
      || lunchSandbox.recipesLunchData;

    assert(dinnerData, 'recipes.js must define recipesData on global scope');
    assert(lunchData, 'recipeslunch.js must define recipesLunchData (module.exports or global)');

    validateRecipeObject('Dinner recipesData', dinnerData);
    validateRecipeObject('Lunch recipesLunchData', lunchData);

    console.log('validate:recipes OK');
  } catch (error) {
    fail(error.message || String(error));
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main();
