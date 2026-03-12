function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStoredRecipeHtml(recipeValue) {
  if (typeof recipeValue === 'string') return recipeValue.trim();
  if (isPlainObject(recipeValue)) {
    if (typeof recipeValue.generatedHtml === 'string') return recipeValue.generatedHtml.trim();
    if (typeof recipeValue.recipeHtml === 'string') return recipeValue.recipeHtml.trim();
  }
  return '';
}

function validateStoredRecipeEntry(label, recipeValue) {
  const html = normalizeStoredRecipeHtml(recipeValue);
  assert(html, `${label} must be a non-empty recipe HTML string or object with generatedHtml`);
  assert(/<h2[\s>]/i.test(html), `${label} is missing an <h2> title`);
  assert(
    /<h3[^>]*>\s*Ingredients\s*<\/h3>/i.test(html) || /<table[\s>]/i.test(html),
    `${label} is missing ingredient content`,
  );
}

function validateRecipeDataset(label, data) {
  assert(isPlainObject(data), `${label} must be an object`);
  const weekKeys = Object.keys(data).filter((key) => /^\d+$/.test(String(key)));
  assert(weekKeys.length > 0, `${label} must contain at least one numeric week key`);

  weekKeys.forEach((weekKey) => {
    const weekData = data[weekKey];
    assert(isPlainObject(weekData), `${label} week ${weekKey} must be an object`);
    const recipeKeys = Object.keys(weekData);
    assert(recipeKeys.length > 0, `${label} week ${weekKey} must contain recipe entries`);
    recipeKeys.forEach((recipeKey) => {
      validateStoredRecipeEntry(`${label} week ${weekKey} recipe "${recipeKey}"`, weekData[recipeKey]);
    });
  });

  return true;
}

function normalizePatchIngredient(ingredient) {
  if (typeof ingredient === 'string') {
    const name = ingredient.trim();
    assert(name, 'recipeData.ingredients must not contain blank strings');
    return { name, qty: null, unit: '', notes: '' };
  }

  assert(isPlainObject(ingredient), 'recipeData.ingredients entries must be strings or objects');
  const name = String(ingredient.name || ingredient.original || '').trim();
  assert(name, 'recipeData.ingredients entries must include a name');

  return {
    name,
    qty: ingredient.qty == null || ingredient.qty === '' ? null : ingredient.qty,
    unit: String(ingredient.unit || '').trim(),
    notes: String(ingredient.notes || '').trim(),
  };
}

function validateRecipePatchData(recipeData) {
  assert(isPlainObject(recipeData), 'recipeData must be an object');
  const title = String(recipeData.title || '').trim();
  assert(title, 'recipeData.title is required');

  const ingredients = Array.isArray(recipeData.ingredients) ? recipeData.ingredients.map(normalizePatchIngredient) : [];
  const steps = Array.isArray(recipeData.steps)
    ? recipeData.steps.map((step) => String(step || '').trim()).filter(Boolean)
    : [];

  assert(ingredients.length > 0, 'recipeData.ingredients must contain at least one ingredient');
  assert(steps.length > 0, 'recipeData.steps must contain at least one step');

  return {
    title,
    servings: String(recipeData.servings || recipeData.yield || '').trim(),
    sourceUrl: String(recipeData.sourceUrl || '').trim(),
    generatedHtml: String(recipeData.generatedHtml || '').trim(),
    ingredients,
    steps,
  };
}

module.exports = {
  isPlainObject,
  normalizeStoredRecipeHtml,
  validateRecipeDataset,
  validateRecipePatchData,
};
