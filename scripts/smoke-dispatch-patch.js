#!/usr/bin/env node

function getApiBase() {
  const argBase = process.argv[2] ? String(process.argv[2]).trim() : '';
  const envBase = process.env.CHEF_API_BASE ? String(process.env.CHEF_API_BASE).trim() : '';
  const base = argBase || envBase;
  if (!base) {
    throw new Error('Provide API base URL as arg or CHEF_API_BASE env var.');
  }
  return base.replace(/\/+$/, '');
}

async function main() {
  const apiBase = getApiBase();
  const url = `${apiBase}/dispatchPatch`;
  const adminSecret = process.env.CHEF_ADMIN_SECRET || '';

  const fakePatch = {
    patchVersion: 1,
    createdAt: new Date().toISOString(),
    menu: 'dinner',
    week: 1,
    day: 'Monday',
    dishSlotId: 'dinner:week1:Monday:Traditional',
    dishSlotKey: 'Traditional',
    oldDishName: 'Placeholder Dish',
    oldRecipeKey: 'Placeholder Dish',
    recipeData: {
      title: 'Smoke Test Recipe',
      servings: '1',
      ingredients: [{ name: 'salt', qty: 1, unit: 'tsp', notes: '' }],
      steps: ['Mix and serve.'],
      sourceUrl: 'https://example.com/smoke-test',
      generatedHtml: '<h2>Smoke Test Recipe</h2>'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminSecret ? { 'x-admin-secret': adminSecret } : {})
    },
    body: JSON.stringify({ patch: fakePatch })
  });

  const body = await response.text();
  console.log(`URL: ${url}`);
  console.log(`Status: ${response.status}`);
  console.log(`Body: ${body}`);

  if (response.status === 404) {
    throw new Error('Dispatch endpoint returned 404.');
  }
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
