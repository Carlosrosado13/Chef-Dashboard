#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadData(filePath, bindingName) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;
  const ctx = vm.createContext(runtime);
  vm.runInContext(source, ctx, { filename: path.basename(filePath) });

  const fromWindow = ctx.window && ctx.window[bindingName];
  const fromGlobal = ctx.globalThis && ctx.globalThis[bindingName];
  const fromModule = ctx.module && ctx.module.exports && ctx.module.exports[bindingName];
  const fromBinding = vm.runInContext(`typeof ${bindingName} !== "undefined" ? ${bindingName} : undefined`, ctx);

  return fromWindow || fromGlobal || fromModule || fromBinding || null;
}

function assertWeekShape(label, data) {
  if (!data || typeof data !== 'object') {
    throw new Error(`${label}: data missing or invalid`);
  }

  const availableWeeks = Object.keys(data).filter((key) => /^\d+$/.test(String(key)));
  if (!availableWeeks.length) {
    throw new Error(`${label}: no numeric week keys found`);
  }

  const missing = [];
  for (let week = 1; week <= 4; week += 1) {
    if (!Object.prototype.hasOwnProperty.call(data, String(week)) && !Object.prototype.hasOwnProperty.call(data, week)) {
      missing.push(week);
    }
  }
  if (missing.length) {
    console.warn(`WARN: ${label} missing week(s): ${missing.join(', ')}`);
  }

  availableWeeks.forEach((week) => {
    const weekData = data[week];
    if (!weekData || typeof weekData !== 'object' || Array.isArray(weekData)) {
      throw new Error(`${label}: week ${week} invalid`);
    }
    if (!Object.keys(weekData).length) {
      throw new Error(`${label}: week ${week} has no entries`);
    }
  });
}

function main() {
  const dinnerPath = path.join(ROOT, 'recipes.js');
  const lunchPath = path.join(ROOT, 'recipeslunch.js');

  const dinner = loadData(dinnerPath, 'recipesData');
  const lunch = loadData(lunchPath, 'recipesLunchData');

  assertWeekShape('Dinner', dinner);
  assertWeekShape('Lunch', lunch);

  console.log('smoke:recipes OK');
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message || String(error)}`);
  process.exit(1);
}
