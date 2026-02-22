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
  if (!condition) throw new Error(message);
}

function loadScript(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  const context = vm.createContext(runtime);
  vm.runInContext(source, context, { filename: path.basename(filePath) });
  return { context, source };
}

function getBinding(context, name) {
  return vm.runInContext(`typeof ${name} !== "undefined" ? ${name} : undefined`, context);
}

function getRecipeData(context, source, kind) {
  if (kind === 'dinner') {
    return {
      data:
        context.window?.recipesData ||
        context.globalThis?.recipesData ||
        context.recipesData ||
        getBinding(context, 'recipesData') ||
        null,
      hasWindowAssignment: /window\.recipesData\s*=/.test(source),
      hasBinding: vm.runInContext('typeof recipesData !== "undefined"', context),
    };
  }

  return {
    data:
      context.window?.recipesLunchData ||
      context.globalThis?.recipesLunchData ||
      (context.module && context.module.exports && context.module.exports.recipesLunchData) ||
      context.recipesLunchData ||
      getBinding(context, 'recipesLunchData') ||
      null,
    hasWindowAssignment: /window\.recipesLunchData\s*=/.test(source),
    hasBinding: vm.runInContext('typeof recipesLunchData !== "undefined"', context),
  };
}

function validateRecipeObject(label, data) {
  assert(data && typeof data === 'object' && !Array.isArray(data), `${label} must be an object`);
  const availableWeekKeys = Object.keys(data).filter((key) => /^\d+$/.test(String(key)));
  assert(availableWeekKeys.length > 0, `${label} must contain at least one numeric week key`);

  const missingWeeks = [];
  for (let week = 1; week <= 4; week += 1) {
    if (!Object.prototype.hasOwnProperty.call(data, String(week)) && !Object.prototype.hasOwnProperty.call(data, week)) {
      missingWeeks.push(week);
    }
  }
  if (missingWeeks.length) {
    console.warn(`WARN: ${label} is missing week(s): ${missingWeeks.join(', ')}`);
  }

  availableWeekKeys.forEach((weekKey) => {
    const weekData = data[weekKey];
    assert(weekData && typeof weekData === 'object' && !Array.isArray(weekData), `${label} week ${weekKey} must be an object`);

    const recipeKeys = Object.keys(weekData);
    assert(recipeKeys.length > 0, `${label} week ${weekKey} must have recipe entries`);

    const hasRenderable = recipeKeys.some((key) => {
      const value = weekData[key];
      return typeof value === 'string' || (value && typeof value === 'object');
    });
    assert(hasRenderable, `${label} week ${weekKey} must contain renderable recipes`);
  });
}

function main() {
  try {
    const dinner = loadScript(DINNER_FILE);
    const lunch = loadScript(LUNCH_FILE);

    const dinnerInfo = getRecipeData(dinner.context, dinner.source, 'dinner');
    const lunchInfo = getRecipeData(lunch.context, lunch.source, 'lunch');

    assert(dinnerInfo.data, 'recipes.js could not expose dinner data');
    assert(lunchInfo.data, 'recipeslunch.js could not expose lunch data');

    assert(
      dinnerInfo.hasWindowAssignment || dinnerInfo.hasBinding,
      'recipes.js must set window.recipesData or provide recipesData binding'
    );
    assert(
      lunchInfo.hasWindowAssignment || lunchInfo.hasBinding,
      'recipeslunch.js must set window.recipesLunchData or provide recipesLunchData binding'
    );

    validateRecipeObject('Dinner recipesData', dinnerInfo.data);
    validateRecipeObject('Lunch recipesLunchData', lunchInfo.data);

    console.log('validate:recipes OK');
  } catch (error) {
    fail(error.message || String(error));
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main();
