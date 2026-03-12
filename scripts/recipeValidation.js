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
  assert(Array.isArray(data), `${label} must be an array`);
  assert(data.length > 0, `${label} must contain recipes`);

  data.forEach((record, index) => {
    assert(isPlainObject(record), `${label}[${index}] must be an object`);
    assert(String(record.title || '').trim(), `${label}[${index}].title is required`);
    assert(Number.isFinite(Number(record.week)) && Number(record.week) > 0, `${label}[${index}].week is required`);
    validateStoredRecipeEntry(`${label}[${index}] "${record.title}"`, record);

    if (Array.isArray(record.ingredients)) {
      record.ingredients.forEach((ingredient, ingredientIndex) => {
        assert(isPlainObject(ingredient), `${label}[${index}].ingredients[${ingredientIndex}] must be an object`);
        assert(String(ingredient.name || '').trim(), `${label}[${index}].ingredients[${ingredientIndex}].name is required`);
        assert(String(ingredient.amount || '').trim(), `${label}[${index}].ingredients[${ingredientIndex}].amount is required`);
      });
    }

    if (Array.isArray(record.steps)) {
      record.steps.forEach((step, stepIndex) => {
        assert(String(step || '').trim(), `${label}[${index}].steps[${stepIndex}] must be a non-empty string`);
      });
    }
  });

  return true;
}

function normalizePatchIngredient(ingredient) {
  if (typeof ingredient === 'string') {
    const name = ingredient.trim();
    assert(name, 'recipeData.ingredients must not contain blank strings');
    return { name, amount: '', qty: null, unit: '', notes: '' };
  }

  assert(isPlainObject(ingredient), 'recipeData.ingredients entries must be strings or objects');
  const name = String(ingredient.name || ingredient.original || '').trim();
  assert(name, 'recipeData.ingredients entries must include a name');
  const amount = String(ingredient.amount || '').trim();
  const qty = ingredient.qty == null || ingredient.qty === '' ? null : ingredient.qty;
  const unit = String(ingredient.unit || '').trim();
  const normalizedAmount = amount || [qty, unit].filter(Boolean).join(' ').trim();
  assert(normalizedAmount, 'recipeData.ingredients entries must include an amount');

  return {
    name,
    amount: normalizedAmount,
    qty,
    unit,
    notes: String(ingredient.notes || '').trim(),
  };
}

function validateRecipePatchData(recipeData) {
  assert(isPlainObject(recipeData), 'recipeData must be an object');
  const title = String(recipeData.title || '').trim();
  const portion = String(recipeData.portion || '').trim();
  const yieldValue = String(recipeData.yield || recipeData.servings || '').trim();
  assert(title, 'recipeData.title is required');
  assert(portion || yieldValue, 'recipeData.portion or recipeData.yield is required');

  const ingredients = Array.isArray(recipeData.ingredients) ? recipeData.ingredients.map(normalizePatchIngredient) : [];
  const steps = Array.isArray(recipeData.steps)
    ? recipeData.steps.map((step) => String(step || '').trim()).filter(Boolean)
    : [];

  assert(ingredients.length > 0, 'recipeData.ingredients must contain at least one ingredient');
  assert(ingredients.every((item) => String(item.amount || '').trim()), 'recipeData.ingredients must include amounts');
  assert(steps.length > 0, 'recipeData.steps must contain at least one step');

  return {
    title,
    portion,
    yield: yieldValue,
    servings: yieldValue || portion,
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
