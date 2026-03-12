#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { readRecipesJson } = require('./loadRecipesJson');
const { readIngredientsJson, writeIngredientsJson } = require('./dataStore');

const ROOT_DIR = path.resolve(__dirname, '..');
const MASTER_INGREDIENTS_XLSX_PATH = path.join(ROOT_DIR, 'ingredients_master.xlsx');

const RULES = [
  { category: 'Protein', keywords: ['chicken', 'beef', 'pork', 'shrimp', 'salmon', 'fish', 'lamb', 'turkey', 'sausage', 'egg'] },
  { category: 'Dairy', keywords: ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'parmesan', 'feta', 'mozzarella'] },
  { category: 'Greens', keywords: ['lettuce', 'arugula', 'spinach', 'kale', 'romaine', 'mixed greens'] },
  { category: 'Vegetable', keywords: ['onion', 'garlic', 'carrot', 'zucchini', 'tomato', 'pepper', 'mushroom', 'potato', 'eggplant'] },
  { category: 'Fruit', keywords: ['apple', 'berry', 'lemon', 'orange', 'mango', 'banana'] },
  { category: 'Starch', keywords: ['rice', 'pasta', 'bread', 'flour', 'polenta', 'gnocchi'] },
  { category: 'Dry', keywords: ['flour', 'cornstarch', 'cornmeal', 'sugar', 'cocoa'] },
  { category: 'Spices', keywords: ['salt', 'pepper', 'paprika', 'cumin', 'chili', 'thyme', 'rosemary'] },
  { category: 'Alcohol', keywords: ['wine', 'brandy', 'beer'] },
  { category: 'Can', keywords: ['canned', 'tomato paste', 'canned beans'] },
  { category: 'Frozen', keywords: ['frozen'] },
];

function decodeHtmlEntities(value) {
  if (!value) return '';

  const named = value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');

  return named
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanText(value) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRecipeHtmlStrings(dataset) {
  const htmlStrings = [];
  if (Array.isArray(dataset)) {
    dataset.forEach((record) => {
      const html = record && typeof record.generatedHtml === 'string' ? record.generatedHtml : '';
      if (html) htmlStrings.push(html);
    });
    return htmlStrings;
  }
  if (!dataset || typeof dataset !== 'object') return htmlStrings;

  for (const weekRecipes of Object.values(dataset)) {
    if (!weekRecipes || typeof weekRecipes !== 'object') continue;
    for (const recipeHtml of Object.values(weekRecipes)) {
      if (typeof recipeHtml === 'string') {
        htmlStrings.push(recipeHtml);
      } else if (recipeHtml && typeof recipeHtml.generatedHtml === 'string') {
        htmlStrings.push(recipeHtml.generatedHtml);
      }
    }
  }

  return htmlStrings;
}

function extractIngredientsFromHtml(recipeHtml) {
  const ingredients = [];
  const tbodyMatches = recipeHtml.match(/<tbody[\s\S]*?<\/tbody>/gi) || [];

  for (const tbody of tbodyMatches) {
    const trMatches = tbody.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const tr of trMatches) {
      const firstTdMatch = tr.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i);
      if (!firstTdMatch) continue;

      const ingredient = cleanText(firstTdMatch[1]);
      if (!ingredient) continue;
      if (ingredient.toLowerCase() === 'ingredient') continue;

      ingredients.push(ingredient);
    }
  }

  return ingredients;
}

function classifyIngredient(ingredient) {
  const lower = ingredient.toLowerCase();

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) {
        return rule.category;
      }
    }
  }

  return 'Uncategorized';
}

async function writeExcel(entries) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ingredients');

  sheet.columns = [
    { header: 'Ingredient', key: 'ingredient', width: 48 },
    { header: 'Category', key: 'category', width: 20 },
  ];

  for (const entry of entries) {
    sheet.addRow({ ingredient: entry.name, category: entry.category });
  }

  await workbook.xlsx.writeFile(MASTER_INGREDIENTS_XLSX_PATH);
}

async function main() {
  const jsonOnly = process.argv.includes('--json-only');
  const recipes = readRecipesJson();
  const dinnerData = recipes.dinner;
  const lunchData = recipes.lunch;

  const allRecipeHtml = [
    ...getRecipeHtmlStrings(dinnerData),
    ...getRecipeHtmlStrings(lunchData),
  ];

  const extractedIngredients = [];
  for (const recipeHtml of allRecipeHtml) {
    extractedIngredients.push(...extractIngredientsFromHtml(recipeHtml));
  }

  const deduped = new Map();
  for (const ingredient of extractedIngredients) {
    const key = ingredient.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, ingredient);
    }
  }

  const entries = Array.from(deduped.values())
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, category: classifyIngredient(name) }));

  const currentIngredients = readIngredientsJson();
  writeIngredientsJson({
    ...currentIngredients,
    masterIngredients: entries,
  });

  if (!jsonOnly) {
    await writeExcel(entries);
  }

  console.log(`Total extracted: ${extractedIngredients.length}`);
  console.log(`Unique ingredients: ${entries.length}`);
  console.log('JSON output: data/ingredients.json');
  if (!jsonOnly) {
    console.log(`XLSX output: ${MASTER_INGREDIENTS_XLSX_PATH}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
