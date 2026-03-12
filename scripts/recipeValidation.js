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

function hasRecipeTitle(html) {
  return /<h2[\s>][\s\S]*?<\/h2>/i.test(html);
}

function hasPortionInfo(html) {
  return /<(p|div|span)[^>]*>\s*(yield|portion)\s*:/i.test(html);
}

function hasIngredientTable(html) {
  return /<table[\s>][\s\S]*?<\/table>/i.test(html);
}

function hasScalingQuantities(html) {
  return /<th[^>]*>\s*50\s*<\/th>/i.test(html) &&
    /<th[^>]*>\s*100\s*<\/th>/i.test(html) &&
    /<th[^>]*>\s*150\s*<\/th>/i.test(html);
}

function hasMethodSection(html) {
  return /<h3[^>]*>\s*Method\s*<\/h3>/i.test(html) &&
    (/<ol[\s>][\s\S]*?<li[\s>]/i.test(html) || /<p[^>]*>\s*[^<]+<\/p>/i.test(html));
}

function validateStoredRecipeEntry(label, recipeValue) {
  const html = normalizeStoredRecipeHtml(recipeValue);
  assert(html, `${label} must be a non-empty recipe HTML string or object with generatedHtml`);
  assert(hasRecipeTitle(html), `${label} is missing an <h2> title`);
  assert(hasIngredientTable(html), `${label} is missing an ingredient table`);
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
  const servings = String(recipeData.servings || recipeData.yield || '').trim();
  assert(title, 'recipeData.title is required');
  assert(servings, 'recipeData.servings is required');

  const ingredients = Array.isArray(recipeData.ingredients) ? recipeData.ingredients.map(normalizePatchIngredient) : [];
  const steps = Array.isArray(recipeData.steps)
    ? recipeData.steps.map((step) => String(step || '').trim()).filter(Boolean)
    : [];

  assert(ingredients.length > 0, 'recipeData.ingredients must contain at least one ingredient');
  assert(
    ingredients.some((item) => item.qty != null || item.unit),
    'recipeData.ingredients must include quantity or unit values',
  );
  assert(steps.length > 0, 'recipeData.steps must contain at least one step');

  return {
    title,
    servings,
    sourceUrl: String(recipeData.sourceUrl || '').trim(),
    generatedHtml: String(recipeData.generatedHtml || '').trim(),
    ingredients,
    steps,
  };
}

module.exports = {
  hasIngredientTable,
  hasMethodSection,
  hasPortionInfo,
  hasRecipeTitle,
  hasScalingQuantities,
  isPlainObject,
  normalizeStoredRecipeHtml,
  validateRecipeDataset,
  validateRecipePatchData,
};
