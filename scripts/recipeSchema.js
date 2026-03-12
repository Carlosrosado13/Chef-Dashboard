const HTML_ENTITY_MAP = [
  [/&nbsp;/gi, ' '],
  [/&amp;/gi, '&'],
  [/&quot;/gi, '"'],
  [/&#39;/gi, "'"],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
];

function decodeEntities(value) {
  let output = String(value || '');
  HTML_ENTITY_MAP.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

function stripHtml(value) {
  return decodeEntities(String(value || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeText(value) {
  return stripHtml(value);
}

function normalizeToken(value) {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseAmountAndUnit(amountText) {
  const cleaned = sanitizeText(amountText).replace(/,/g, '.');
  if (!cleaned) return { amount: '', unit: '' };
  if (/^to taste$/i.test(cleaned)) return { amount: 'to taste', unit: '' };

  const match = cleaned.match(/^(.+?)\s+([A-Za-z][A-Za-z/%.-]*)$/);
  if (!match) return { amount: cleaned, unit: '' };
  return {
    amount: cleaned,
    unit: sanitizeText(match[2] || ''),
  };
}

function extractTitleFromHtml(recipeHtml, fallbackTitle = '') {
  const match = String(recipeHtml || '').match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return sanitizeText(match ? match[1] : fallbackTitle);
}

function extractPortionFields(recipeHtml) {
  const html = String(recipeHtml || '');
  const portionMatch = html.match(/<(p|div|span)[^>]*>\s*(?:<strong>)?\s*Portion\s*:?\s*(?:<\/strong>)?\s*([\s\S]*?)<\/(p|div|span)>/i);
  if (portionMatch) {
    return {
      portion: sanitizeText(portionMatch[2]),
      yield: '',
    };
  }

  const yieldMatch = html.match(/<(p|div|span)[^>]*>\s*(?:<strong>)?\s*Yield\s*:?\s*(?:<\/strong>)?\s*([\s\S]*?)<\/(p|div|span)>/i);
  if (yieldMatch) {
    return {
      portion: '',
      yield: sanitizeText(yieldMatch[2]),
    };
  }

  return {
    portion: '',
    yield: 'Not specified',
  };
}

function extractIngredientsFromHtml(recipeHtml) {
  const html = String(recipeHtml || '');
  const rows = [];
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  rowMatches.forEach((rowHtml) => {
    const cells = rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length < 2) return;

    const name = sanitizeText(cells[0]);
    if (!name || /^ingredient$/i.test(name)) return;

    const amountCell = cells.slice(1).map((cell) => sanitizeText(cell)).find(Boolean) || '';
    const parsedAmount = parseAmountAndUnit(amountCell);
    if (!parsedAmount.amount) return;

    rows.push({
      name,
      amount: parsedAmount.amount,
      unit: parsedAmount.unit,
    });
  });

  return rows;
}

function extractStepsFromHtml(recipeHtml) {
  const html = String(recipeHtml || '');
  const olMatch = html.match(/<h3[^>]*>\s*Method\s*<\/h3>\s*<ol[\s\S]*?>([\s\S]*?)<\/ol>/i);
  if (olMatch) {
    const liMatches = Array.from(olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
    const steps = liMatches.map((match) => sanitizeText(match[1])).filter(Boolean);
    if (steps.length) return steps;
  }

  const paragraphMatches = [];
  const methodHeading = html.search(/<h3[^>]*>\s*Method\s*<\/h3>/i);
  if (methodHeading >= 0) {
    const methodBlock = html
      .slice(methodHeading)
      .replace(/^<h3[^>]*>\s*Method\s*<\/h3>/i, '');
    const untilNextHeading = methodBlock.split(/<h3[^>]*>/i)[0];
    const pMatches = Array.from(untilNextHeading.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi));
    pMatches.forEach((match) => {
      const text = sanitizeText(match[1]);
      if (text) paragraphMatches.push(text);
    });
  }

  return paragraphMatches;
}

function normalizeRecipeRecord(record, defaults = {}) {
  const source = record && typeof record === 'object' ? record : {};
  const recipeHtml = typeof source.generatedHtml === 'string'
    ? source.generatedHtml.trim()
    : typeof source.recipeHtml === 'string'
      ? source.recipeHtml.trim()
      : '';
  const title = sanitizeText(source.title || extractTitleFromHtml(recipeHtml, defaults.title || ''));
  const portionFields = extractPortionFields(recipeHtml);
  const portion = sanitizeText(source.portion || portionFields.portion || '');
  const yieldValue = sanitizeText(source.yield || source.servings || portionFields.yield || '');
  const structuredIngredients = Array.isArray(source.ingredients)
    ? source.ingredients
      .map((ingredient) => {
        if (!ingredient || typeof ingredient !== 'object') return null;
        return {
          name: sanitizeText(ingredient.name || ''),
          amount: sanitizeText(ingredient.amount || ''),
          unit: sanitizeText(ingredient.unit || ''),
        };
      })
      .filter((ingredient) => ingredient && ingredient.name && ingredient.amount)
    : [];
  const ingredients = structuredIngredients.length ? structuredIngredients : extractIngredientsFromHtml(recipeHtml);
  const structuredSteps = Array.isArray(source.steps)
    ? source.steps.map((step) => sanitizeText(step)).filter(Boolean)
    : [];
  const steps = structuredSteps.length ? structuredSteps : extractStepsFromHtml(recipeHtml);
  const week = Number(source.week || defaults.week || 0);

  return {
    menu: defaults.menu || sanitizeText(source.menu || ''),
    week: Number.isFinite(week) && week > 0 ? week : 0,
    title,
    recipeKey: sanitizeText(source.recipeKey || source.title || defaults.title || ''),
    portion,
    yield: yieldValue || (portion ? '' : 'Not specified'),
    ingredients,
    steps,
    generatedHtml: recipeHtml,
    sourceUrl: sanitizeText(source.sourceUrl || ''),
  };
}

function recipeFromHtml(menu, week, recipeKey, recipeHtml) {
  const title = extractTitleFromHtml(recipeHtml, recipeKey);
  const portionFields = extractPortionFields(recipeHtml);
  return normalizeRecipeRecord({
    menu,
    week,
    title,
    recipeKey,
    portion: portionFields.portion,
    yield: portionFields.yield,
    ingredients: extractIngredientsFromHtml(recipeHtml),
    steps: extractStepsFromHtml(recipeHtml),
    generatedHtml: String(recipeHtml || '').trim(),
  }, { menu, week, title });
}

function migrateRecipeCollection(menu, data) {
  if (Array.isArray(data)) {
    return data.map((record) => normalizeRecipeRecord(record, { menu })).filter((record) => record.title);
  }

  const output = [];
  Object.keys(data || {}).forEach((weekKey) => {
    const weekNumber = Number(String(weekKey).replace(/[^\d]/g, ''));
    const recipes = data[weekKey];
    if (!Number.isFinite(weekNumber) || !recipes || typeof recipes !== 'object') return;

    Object.keys(recipes).forEach((recipeKey) => {
      output.push(recipeFromHtml(menu, weekNumber, recipeKey, recipes[recipeKey]));
    });
  });
  return output;
}

function groupRecipesByWeek(recipeList) {
  const grouped = {};
  (Array.isArray(recipeList) ? recipeList : []).forEach((record) => {
    const normalized = normalizeRecipeRecord(record);
    if (!normalized.title || !normalized.week) return;
    const weekKey = String(normalized.week);
    if (!grouped[weekKey]) grouped[weekKey] = {};
    grouped[weekKey][normalized.recipeKey || normalized.title] = normalized;
  });
  return grouped;
}

function validateRecipeRecord(record, label = 'recipe') {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`${label} must be an object`);
  }
  if (!sanitizeText(record.title)) throw new Error(`${label} title is required`);
  if (!sanitizeText(record.portion || record.yield)) throw new Error(`${label} portion or yield is required`);
  if (!Array.isArray(record.ingredients) || !record.ingredients.length) throw new Error(`${label} must include ingredients`);
  record.ingredients.forEach((ingredient, index) => {
    if (!ingredient || typeof ingredient !== 'object') throw new Error(`${label} ingredient ${index + 1} must be an object`);
    if (!sanitizeText(ingredient.name)) throw new Error(`${label} ingredient ${index + 1} name is required`);
    if (!sanitizeText(ingredient.amount)) throw new Error(`${label} ingredient ${index + 1} amount is required`);
  });
  if (!Array.isArray(record.steps) || !record.steps.length) throw new Error(`${label} must include steps`);
  record.steps.forEach((step, index) => {
    if (!sanitizeText(step)) throw new Error(`${label} step ${index + 1} must be a non-empty string`);
  });
  if (!record.week || !Number.isFinite(Number(record.week))) throw new Error(`${label} week is required`);
  return true;
}

function validateRecipeCollection(label, data) {
  if (!Array.isArray(data)) throw new Error(`${label} must be an array`);
  if (!data.length) throw new Error(`${label} must contain recipes`);
  data.forEach((record, index) => validateRecipeRecord(record, `${label}[${index}]`));
  return true;
}

module.exports = {
  decodeEntities,
  stripHtml,
  sanitizeText,
  normalizeToken,
  parseAmountAndUnit,
  extractTitleFromHtml,
  extractPortionFields,
  extractIngredientsFromHtml,
  extractStepsFromHtml,
  normalizeRecipeRecord,
  recipeFromHtml,
  migrateRecipeCollection,
  groupRecipesByWeek,
  validateRecipeRecord,
  validateRecipeCollection,
};
