const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,x-admin-secret',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

const DAY_ALIASES = {
  monday: ['Monday', 'Mon'],
  tuesday: ['Tuesday', 'Tue', 'Tues'],
  wednesday: ['Wednesday', 'Wed'],
  thursday: ['Thursday', 'Thu', 'Thur', 'Thurs'],
  friday: ['Friday', 'Fri'],
  saturday: ['Saturday', 'Sat'],
  sunday: ['Sunday', 'Sun'],
};

const KNOWN_UNITS = new Set([
  'tsp', 'tsps', 'teaspoon', 'teaspoons',
  'tbsp', 'tbsps', 'tablespoon', 'tablespoons',
  'cup', 'cups',
  'oz', 'ounce', 'ounces',
  'lb', 'lbs', 'pound', 'pounds',
  'g', 'gram', 'grams',
  'kg', 'kilogram', 'kilograms',
  'ml', 'milliliter', 'milliliters',
  'l', 'liter', 'liters',
  'clove', 'cloves',
  'can', 'cans',
  'pinch', 'pinches',
]);

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'POST' && url.pathname === '/extract') {
        return await handleExtract(request);
      }

      if (request.method === 'POST' && url.pathname === '/apply') {
        return await handleApply(request, env);
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (error) {
      return json({ ok: false, error: error.message || String(error) }, 500);
    }
  },
};

async function handleExtract(request) {
  const body = await parseJsonBody(request);
  const sourceUrl = sanitizeText(body.url || '');
  if (!sourceUrl) {
    return json({ ok: false, error: 'url is required' }, 400);
  }

  const response = await fetch(sourceUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'ChefDashboardRecipeBot/2.0 (+https://github.com/)'
    }
  });

  if (!response.ok) {
    return json({ ok: false, error: `Failed to fetch source URL (${response.status})` }, 400);
  }

  const html = await response.text();
  const jsonLdRecipe = extractPrimaryRecipeFromJsonLd(html);
  if (!jsonLdRecipe) {
    return json({ ok: false, error: 'No Recipe JSON-LD found at URL; cannot extract structured recipe data.' }, 422);
  }

  const ingredientLines = extractIngredientStrings(html, jsonLdRecipe);

  if (!ingredientLines.length) {
    return json({ ok: false, error: 'No ingredients could be extracted from the URL' }, 422);
  }

  const steps = normalizeRecipeInstructions(jsonLdRecipe?.recipeInstructions);
  if (!steps.length) {
    return json({ ok: false, error: 'No recipe instructions found in structured data.' }, 422);
  }
  const title = sanitizeText(jsonLdRecipe?.name || extractTitleFromHtml(html) || 'Untitled Recipe');
  const servings = normalizeServings(jsonLdRecipe?.recipeYield);

  const extractedRecipe = {
    title,
    servings,
    ingredients: ingredientLines,
    steps,
    sourceUrl,
  };
  extractedRecipe.generatedHtml = generateRecipeHtml(extractedRecipe);

  return json({ ok: true, extractedRecipe }, 200);
}

async function handleApply(request, env) {
  if (!env.ADMIN_SECRET) {
    return json({ ok: false, error: 'ADMIN_SECRET is not configured' }, 500);
  }

  const providedSecret = request.headers.get('x-admin-secret') || '';
  if (providedSecret !== env.ADMIN_SECRET) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  const body = await parseJsonBody(request);
  const menuValue = sanitizeText(body.menu || '').toLowerCase();
  const menu = menuValue === 'dinner' ? 'dinner' : menuValue === 'lunch' ? 'lunch' : '';
  const week = Number(body.week);
  const day = sanitizeText(body.day || '');
  const dishSlotId = sanitizeText(body.dishSlotId || body.dishId || '');

  if (!menu) {
    return json({ ok: false, error: 'menu must be Dinner or Lunch' }, 422);
  }
  if (!Number.isInteger(week) || week < 1 || week > 4) {
    return json({ ok: false, error: 'week must be 1..4' }, 422);
  }
  if (!day) {
    return json({ ok: false, error: 'day is required' }, 422);
  }
  if (!dishSlotId) {
    return json({ ok: false, error: 'dishSlotId is required' }, 422);
  }

  const recipeInput = body.extractedRecipe || body.recipeJson;
  const normalizedRecipe = normalizeRecipePayload(recipeInput);
  if (!normalizedRecipe.ingredients.length) {
    return json({ ok: false, error: 'Empty ingredients - extraction failed' }, 422);
  }

  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return json({
      ok: true,
      status: 'patch_required',
      message: 'GitHub commit is not configured in Worker env; use local patch apply workflow.',
      command: 'node scripts/applyRecipePatch.js <patch.json>',
      dishSlotId,
    }, 200);
  }

  const targetPath = menu === 'dinner' ? 'recipes.js' : 'recipeslunch.js';
  const branch = env.GITHUB_BRANCH || 'main';

  const fileInfo = await githubGetFile(env, targetPath, branch);
  const parsed = parseRecipeScript(fileInfo.content, menu);

  const applyResult = applyRecipeUpdate({
    dataObject: parsed.dataObject,
    week,
    day,
    dishSlotId,
    recipe: {
      ...normalizedRecipe,
      generatedHtml: generateRecipeHtml(normalizedRecipe),
    },
    hints: {
      dishSlot: sanitizeText(body.dishSlot || ''),
      recipeKey: sanitizeText(body.recipeKey || ''),
      dishName: sanitizeText(body.dishName || ''),
    },
  });

  if (!applyResult.ok) {
    return json({ ok: false, error: applyResult.error }, 422);
  }

  const updatedFileContent = `window.${parsed.globalName} = ${JSON.stringify(parsed.dataObject, null, 2)};\n`;
  const validateResult = validateRecipeScript(updatedFileContent, menu);
  if (!validateResult.ok) {
    return json({ ok: false, error: validateResult.error }, 422);
  }

  if (dryRun) {
    return json({
      ok: true,
      commitSha: null,
      updatedFile: targetPath,
      dishSlotId,
      message: 'Dry-run succeeded',
      updatedContent: updatedFileContent,
    }, 200);
  }

  const commitMessage = `Auto apply recipe update: ${menu === 'dinner' ? 'Dinner' : 'Lunch'} W${week} ${day} ${dishSlotId}`;
  const commit = await githubUpdateFile(env, {
    path: targetPath,
    branch,
    message: commitMessage,
    content: updatedFileContent,
    sha: fileInfo.sha,
  });

  return json({
    ok: true,
    commitSha: commit.commit?.sha || null,
    updatedFile: targetPath,
    dishSlotId,
    message: 'Recipe updated successfully',
    url: commit.commit?.html_url || null,
  }, 200);
}

function extractPrimaryRecipeFromJsonLd(html) {
  const scripts = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts) {
    const raw = (script[1] || '').trim();
    if (!raw) continue;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      continue;
    }

    const recipes = flattenJsonLdRecipes(parsed);
    if (recipes.length) {
      return recipes[0];
    }
  }

  return null;
}

function extractIngredientStrings(html, recipeNode) {
  const values = [];

  if (recipeNode && Array.isArray(recipeNode.recipeIngredient)) {
    recipeNode.recipeIngredient.forEach((line) => {
      const text = sanitizeText(line);
      if (text) values.push(text);
    });
  }

  if (values.length) {
    return uniqueStrings(values);
  }

  const directPatterns = [
    /<[^>]*class=["'][^"']*wprm-recipe-ingredient[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
  ];
  directPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = sanitizeText(match[1] || '');
      if (text) values.push(text);
    }
  });

  const listContainerPatterns = [
    /<[^>]*class=["'][^"']*recipe-ingredients[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
    /<[^>]*class=["'][^"']*ingredients[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
  ];

  listContainerPatterns.forEach((containerPattern) => {
    let blockMatch;
    while ((blockMatch = containerPattern.exec(html)) !== null) {
      const block = blockMatch[1] || '';
      const liMatches = Array.from(block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
      liMatches.forEach((li) => {
        const text = sanitizeText(li[1] || '');
        if (text) values.push(text);
      });
    }
  });

  return uniqueStrings(values);
}

function normalizeRecipeInstructions(value) {
  const out = [];

  const pushStep = (step) => {
    const text = sanitizeText(step);
    if (text) out.push(text);
  };

  const walk = (node) => {
    if (!node) return;

    if (typeof node === 'string') {
      pushStep(node);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (typeof node === 'object') {
      if (typeof node.text === 'string') {
        pushStep(node.text);
      }
      if (node.itemListElement) {
        walk(node.itemListElement);
      }
    }
  };

  walk(value);
  return out;
}

function normalizeServings(value) {
  if (Array.isArray(value)) {
    return sanitizeText(value[0] || '');
  }
  return sanitizeText(value || '');
}

function parseIngredientLine(line) {
  const original = sanitizeText(line || '');
  if (!original) return null;

  const normalized = original
    .replace(/[\u00BC\u00BD\u00BE\u2153\u2154\u215B]/g, (ch) => {
      if (ch === '\u00BC') return ' 1/4 ';
      if (ch === '\u00BD') return ' 1/2 ';
      if (ch === '\u00BE') return ' 3/4 ';
      if (ch === '\u2153') return ' 1/3 ';
      if (ch === '\u2154') return ' 2/3 ';
      if (ch === '\u215B') return ' 1/8 ';
      return ch;
    })
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized.split(' ').filter(Boolean);

  let qty = null;
  let unit = '';
  let idx = 0;

  const firstQty = parseQuantityToken(tokens[idx]);
  if (firstQty != null) {
    qty = firstQty;
    idx += 1;

    const secondQty = parseQuantityToken(tokens[idx]);
    if (secondQty != null && /^\d+\/\d+$/.test(tokens[idx])) {
      qty += secondQty;
      idx += 1;
    }
  }

  const next = (tokens[idx] || '').toLowerCase();
  if (KNOWN_UNITS.has(next)) {
    unit = tokens[idx];
    idx += 1;
  }

  const name = sanitizeText(tokens.slice(idx).join(' ')) || original;

  return {
    name,
    qty: Number.isFinite(qty) ? qty : null,
    unit: unit || '',
    notes: '',
  };
}

function parseQuantityToken(token) {
  if (!token) return null;

  if (/^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split('/').map(Number);
    if (!b) return null;
    return a / b;
  }

  if (/^\d+(?:\.\d+)?$/.test(token)) {
    return Number(token);
  }

  return null;
}

function normalizeRecipePayload(input) {
  const source = input && typeof input === 'object' ? input : {};

  const ingredients = (Array.isArray(source.ingredients) ? source.ingredients : [])
    .map((item) => {
      if (typeof item === 'string') {
        return parseIngredientLine(item);
      }
      if (!item || typeof item !== 'object') {
        return null;
      }

      const fallback = parseIngredientLine(item.original || item.raw || '');
      const name = sanitizeText(item.name || fallback?.name || '');
      if (!name) return null;

      return {
        name,
        qty: item.qty == null ? (fallback ? fallback.qty : null) : item.qty,
        unit: sanitizeText(item.unit || (fallback ? fallback.unit : '')),
        notes: sanitizeText(item.notes || ''),
      };
    })
    .filter((item) => item && item.name);

  return {
    title: sanitizeText(source.title || 'Untitled Recipe'),
    servings: normalizeServings(source.servings),
    ingredients,
    steps: normalizeRecipeInstructions(source.steps),
    sourceUrl: sanitizeText(source.sourceUrl || ''),
  };
}

function applyRecipeUpdate({ dataObject, week, day, dishSlotId, recipe, hints }) {
  if (!dataObject || typeof dataObject !== 'object') {
    return { ok: false, error: 'Recipe data object is invalid' };
  }

  const weekData = dataObject[String(week)] || dataObject[week];
  if (!weekData || typeof weekData !== 'object') {
    return { ok: false, error: `Week ${week} not found` };
  }

  const dayKey = findDayKey(weekData, day);
  const dishSlotKey = getDishSlotFromId(dishSlotId);

  if (dayKey) {
    const dayData = weekData[dayKey];
    if (dayData && typeof dayData === 'object') {
      const slotKey = findSlotKey(dayData, dishSlotKey, [hints.dishSlot]);
      if (slotKey) {
        const current = dayData[slotKey];
        if (current && typeof current === 'object' && !Array.isArray(current)) {
          dayData[slotKey] = {
            ...current,
            title: recipe.title,
            sourceUrl: recipe.sourceUrl,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
            recipeHtml: recipe.generatedHtml,
          };
          return { ok: true };
        }

        dayData[slotKey] = recipe.generatedHtml;
        return { ok: true };
      }
    }
  }

  const flatCandidates = [
    hints.recipeKey,
    hints.dishName,
    recipe.title,
    dishSlotKey,
  ].filter(Boolean);

  const flatKey = resolveFlatRecipeKey(weekData, flatCandidates);
  if (!flatKey) {
    return { ok: false, error: `Could not resolve recipe key for week ${week}, day ${day}, slot ${dishSlotId}` };
  }

  const current = weekData[flatKey];
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    weekData[flatKey] = {
      ...current,
      title: recipe.title,
      sourceUrl: recipe.sourceUrl,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      recipeHtml: recipe.generatedHtml,
    };
  } else {
    weekData[flatKey] = recipe.generatedHtml;
  }

  return { ok: true };
}

function findDayKey(weekData, requestedDay) {
  const normalizedDay = sanitizeText(requestedDay).toLowerCase();
  if (!normalizedDay) return null;

  const aliases = DAY_ALIASES[normalizedDay] || [requestedDay];
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(weekData, alias)) {
      return alias;
    }
  }

  const normalizedAliases = aliases.map((value) => sanitizeText(value).toLowerCase());
  const keys = Object.keys(weekData);
  return keys.find((key) => normalizedAliases.includes(sanitizeText(key).toLowerCase())) || null;
}

function getDishSlotFromId(dishSlotId) {
  const parts = String(dishSlotId || '').split(':');
  if (parts.length >= 4) {
    return sanitizeText(parts.slice(3).join(':'));
  }
  return sanitizeText(dishSlotId || '');
}

function findSlotKey(dayData, dishSlotKey, extras = []) {
  const keys = Object.keys(dayData);
  const candidates = [dishSlotKey, ...extras]
    .map((value) => sanitizeText(value).toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    const exact = keys.find((key) => sanitizeText(key).toLowerCase() === candidate);
    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const partial = keys.find((key) => {
      const normalized = sanitizeText(key).toLowerCase();
      return normalized.includes(candidate) || candidate.includes(normalized);
    });
    if (partial) return partial;
  }

  return null;
}

function resolveFlatRecipeKey(weekData, candidates) {
  const keys = Object.keys(weekData);

  const normalizedCandidates = candidates
    .map((value) => sanitizeText(value).toLowerCase())
    .filter(Boolean);

  for (const candidate of normalizedCandidates) {
    const exact = keys.find((key) => sanitizeText(key).toLowerCase() === candidate);
    if (exact) return exact;
  }

  for (const candidate of normalizedCandidates) {
    const partial = keys.find((key) => {
      const normalized = sanitizeText(key).toLowerCase();
      return normalized.includes(candidate) || candidate.includes(normalized);
    });
    if (partial) return partial;
  }

  return null;
}

function parseRecipeScript(fileText, menu) {
  const expectedGlobal = menu === 'dinner' ? 'recipesData' : 'recipesLunchData';
  const evaluated = evaluateScript(fileText);

  const dataObject =
    evaluated.runtime?.window?.[expectedGlobal] ||
    evaluated.runtime?.globalThis?.[expectedGlobal] ||
    evaluated.locals?.[expectedGlobal] ||
    null;

  if (!dataObject || typeof dataObject !== 'object') {
    throw new Error(`${expectedGlobal} is missing in ${menu === 'dinner' ? 'recipes.js' : 'recipeslunch.js'}`);
  }

  const globalName = detectGlobalName(fileText, expectedGlobal);
  return { dataObject, globalName };
}

function detectGlobalName(fileText, fallback) {
  const match = fileText.match(/window\.(recipesData|recipesLunchData)\s*=/);
  if (match && match[1]) return match[1];
  return fallback;
}

function evaluateScript(scriptText) {
  const runtime = { window: {}, globalThis: {}, self: {}, module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;

  const fn = new Function(
    'window',
    'globalThis',
    'self',
    'module',
    'exports',
    `${scriptText}\nreturn {
      recipesData: typeof recipesData !== 'undefined' ? recipesData : undefined,
      recipesLunchData: typeof recipesLunchData !== 'undefined' ? recipesLunchData : undefined,
    };`
  );

  const locals = fn(runtime, runtime, runtime, runtime.module, runtime.exports) || {};
  return { runtime, locals };
}

function validateRecipeScript(scriptText, menu) {
  const expectedGlobal = menu === 'dinner' ? 'recipesData' : 'recipesLunchData';

  try {
    const parsed = parseRecipeScript(scriptText, menu);
    const dataObject = parsed.dataObject;
    const weekKeys = Object.keys(dataObject || {}).filter((key) => /^\d+$/.test(String(key)) || /^week\s*\d+$/i.test(String(key)));
    if (!weekKeys.length) {
      return { ok: false, error: `${expectedGlobal} has no valid week keys` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function flattenJsonLdRecipes(value) {
  const nodes = [];

  const walk = (node) => {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    nodes.push(node);

    if (Array.isArray(node['@graph'])) {
      node['@graph'].forEach(walk);
    }

    if (node.mainEntity) {
      walk(node.mainEntity);
    }

    if (node.itemListElement) {
      walk(node.itemListElement);
    }
  };

  walk(value);

  return nodes.filter((node) => {
    const type = node['@type'];
    if (Array.isArray(type)) return type.some((item) => String(item).toLowerCase() === 'recipe');
    return String(type || '').toLowerCase() === 'recipe';
  });
}

function extractTitleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? sanitizeText(match[1]) : '';
}

function generateRecipeHtml(recipe) {
  const title = escapeHtml(recipe.title || 'Untitled Recipe');
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];

  const ingredientRows = ingredients.map((item) => {
    const normalized = normalizeIngredientForHtml(item);
    const qty = normalized.qty == null ? '' : String(normalized.qty);
    const unit = normalized.unit ? String(normalized.unit) : '';
    const amount = `${qty} ${unit}`.trim();
    const notes = normalized.notes ? ` (${String(normalized.notes)})` : '';
    return `<tr><td>${escapeHtml(normalized.name || '')}${escapeHtml(notes)}</td><td>${escapeHtml(amount)}</td></tr>`;
  }).join('');

  const stepRows = steps.map((step) => `<li><p>${escapeHtml(step)}</p></li>`).join('');

  return `<h2>${title}</h2><h3>Ingredients</h3><table><thead><tr><th>Ingredient</th><th>Amount</th></tr></thead><tbody>${ingredientRows}</tbody></table><h3>Method</h3><ol type="1">${stepRows}</ol>`;
}

function normalizeIngredientForHtml(value) {
  if (typeof value === 'string') {
    const parsed = parseIngredientLine(value);
    if (parsed) return parsed;
    return { name: sanitizeText(value), qty: null, unit: '', notes: '' };
  }
  if (value && typeof value === 'object') {
    const name = sanitizeText(value.name || value.original || value.raw || '');
    if (name) {
      return {
        name,
        qty: value.qty == null ? null : value.qty,
        unit: sanitizeText(value.unit || ''),
        notes: sanitizeText(value.notes || ''),
      };
    }
  }
  return { name: '', qty: null, unit: '', notes: '' };
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];

  values.forEach((value) => {
    const text = sanitizeText(value || '');
    if (!text) return;

    const key = text.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    out.push(text);
  });

  return out;
}

function sanitizeText(value) {
  return decodeEntities(String(value || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function githubGetFile(env, filePath, branch) {
  const endpoint = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(endpoint, {
    headers: githubHeaders(env.GITHUB_TOKEN),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub read failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const decoded = decodeBase64(data.content || '');

  return { sha: data.sha, content: decoded };
}

async function githubUpdateFile(env, { path, branch, message, content, sha }) {
  const endpoint = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const payload = {
    message,
    branch,
    sha,
    content: encodeBase64(content),
  };

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: githubHeaders(env.GITHUB_TOKEN),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub write failed (${response.status}): ${text}`);
  }

  return response.json();
}

function githubHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'chef-dashboard-update-worker-v2',
  };
}

function encodeBase64(value) {
  const utf8 = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < utf8.length; i += 1) {
    binary += String.fromCharCode(utf8[i]);
  }
  return btoa(binary);
}

function decodeBase64(value) {
  const normalized = value.replace(/\n/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function parseJsonBody(request) {
  let body;
  try {
    body = await request.json();
  } catch (_error) {
    throw new Error('Invalid JSON request body');
  }

  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object');
  }

  return body;
}

function requireEnv(env, keys) {
  for (const key of keys) {
    if (!env[key]) {
      throw new Error(`${key} is not configured`);
    }
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}
