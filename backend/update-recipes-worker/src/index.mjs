const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,x-admin-secret',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'POST' && url.pathname === '/extract') {
        return await handleExtract(request, env);
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

async function handleExtract(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ ok: false, error: 'OPENAI_API_KEY is not configured' }, 500);
  }

  const body = await parseJsonBody(request);
  const sourceUrl = String(body.url || '').trim();
  if (!sourceUrl) {
    return json({ ok: false, error: 'url is required' }, 400);
  }

  const pageResponse = await fetch(sourceUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'ChefDashboardRecipeBot/1.0 (+https://github.com/)'
    }
  });

  if (!pageResponse.ok) {
    return json({ ok: false, error: `Failed to fetch source URL (${pageResponse.status})` }, 400);
  }

  const html = await pageResponse.text();
  const readable = extractReadableText(html);
  const ingredientStrings = extractIngredientStrings(html);

  const openAiRecipe = await extractRecipeWithOpenAI({
    apiKey: env.OPENAI_API_KEY,
    sourceUrl,
    readableText: readable,
  });

  const ingredients = ingredientStrings
    .map(parseIngredientLine)
    .filter((item) => item && item.name && item.name.trim());

  const title = String(openAiRecipe.title || extractRecipeTitleFromJsonLd(html) || 'Untitled Recipe').trim();
  const steps = Array.isArray(openAiRecipe.steps) ? openAiRecipe.steps.map((step) => String(step || '').trim()).filter(Boolean) : [];
  const servings = String(openAiRecipe.servings || '').trim();

  const extractedRecipe = {
    title,
    servings,
    ingredients,
    steps,
    sourceUrl,
  };
  extractedRecipe.generatedHtml = generateRecipeHtml(extractedRecipe);

  return json({ ok: true, extractedRecipe }, 200);
}

async function handleApply(request, env) {
  requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);

  const providedSecret = request.headers.get('x-admin-secret') || '';
  if (!env.ADMIN_SECRET || providedSecret !== env.ADMIN_SECRET) {
    return json({ ok: false, error: 'Invalid admin secret' }, 403);
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const body = await parseJsonBody(request);
  const menu = String(body.menu || '').trim().toLowerCase();
  const week = Number(body.week);
  const day = String(body.day || '').trim();
  const dishSlotId = String(body.dishSlotId || body.dishId || '').trim();
  const dishSlot = String(body.dishSlot || '').trim();
  const dishName = String(body.dishName || '').trim();
  const recipeKey = String(body.recipeKey || '').trim();
  const recipeJson = body.extractedRecipe || body.recipeJson;

  if (!['lunch', 'dinner'].includes(menu)) {
    return json({ ok: false, error: 'menu must be lunch or dinner' }, 422);
  }
  if (!Number.isInteger(week) || week < 1 || week > 4) {
    return json({ ok: false, error: 'week must be 1..4' }, 422);
  }
  if (!day || !dishSlotId || !recipeJson || typeof recipeJson !== 'object') {
    return json({ ok: false, error: 'day, dishSlotId, extractedRecipe are required' }, 422);
  }
  if (!isValidRecipePayload(recipeJson)) {
    return json({ ok: false, error: 'extractedRecipe must include title, ingredients[], and steps[]' }, 422);
  }
  if (!hasNonEmptyIngredients(recipeJson.ingredients)) {
    return json({ ok: false, error: 'Extracted ingredients empty; run Extract again or fix extractor' }, 422);
  }

  const targetPath = menu === 'lunch' ? 'recipeslunch.js' : 'recipes.js';
  const normalizedRecipe = normalizeRecipePayload(recipeJson);
  const generatedHtml = generateRecipeHtml(normalizedRecipe);

  const branch = env.GITHUB_BRANCH || 'main';
  const fileInfo = await githubGetFile(env, targetPath, branch);
  const resolvedRecipeKey = resolveRecipeKeyForWeek({
    fileText: fileInfo.content,
    menu,
    week,
    preferredKeys: [recipeKey, dishName, normalizedRecipe.title],
  });
  if (!resolvedRecipeKey) {
    return json({ ok: false, error: 'Could not resolve target recipe key for selected dishSlotId' }, 422);
  }
  const updatedContent = replaceRecipeEntry({
    fileText: fileInfo.content,
    week,
    recipeKey: resolvedRecipeKey,
    menu,
    replacementHtml: generatedHtml,
  });

  if (updatedContent === fileInfo.content) {
    return json({ ok: false, error: 'No change detected for selected recipe entry' }, 422);
  }

  const validation = validateUpdatedRecipeFile({
    menu,
    fileText: updatedContent,
    week,
    recipeKey: resolvedRecipeKey,
  });
  if (!validation.ok) {
    return json({ ok: false, error: validation.error || 'Updated file failed validation' }, 422);
  }

  if (dryRun) {
    return json({
      ok: true,
      commitSha: null,
      message: 'Recipe validation succeeded (dry run)',
      dryRun: true,
      path: targetPath,
      validation: 'passed',
      updatedFile: updatedContent,
    }, 200);
  }

  const commitMessage = `Auto apply recipe update: ${menu} W${week} ${day} ${dishSlot || dishName || dishSlotId}`;
  const commit = await githubUpdateFile(env, {
    path: targetPath,
    branch,
    message: commitMessage,
    content: updatedContent,
    sha: fileInfo.sha,
  });

  return json({
    ok: true,
    commitSha: commit.commit?.sha || null,
    message: 'Recipe updated successfully',
    commitUrl: commit.commit?.html_url || null,
    url: commit.commit?.html_url || null,
    updatedFile: targetPath,
    dishSlotId,
  }, 200);
}

function replaceRecipeEntry({ fileText, week, recipeKey, menu, replacementHtml }) {
  const weekPattern = new RegExp(`(?:'${week}'|"${week}"|${week})\\s*:\\s*\\{`, 'm');
  const weekMatch = weekPattern.exec(fileText);
  if (!weekMatch) {
    throw new Error(`Week ${week} not found in recipe file`);
  }

  const weekBlockStart = fileText.indexOf('{', weekMatch.index);
  const weekBlockEnd = findMatchingBrace(fileText, weekBlockStart);
  if (weekBlockStart === -1 || weekBlockEnd === -1) {
    throw new Error(`Failed to parse week ${week} block`);
  }

  const weekBlock = fileText.slice(weekBlockStart, weekBlockEnd + 1);
  const keyPattern = new RegExp(`(['"])${escapeRegExp(recipeKey)}\\1\\s*:\\s*`, 'm');
  const keyMatch = keyPattern.exec(weekBlock);
  if (!keyMatch) {
    throw new Error(`Recipe key not found in week ${week}: ${recipeKey}`);
  }

  const valueStartInWeek = keyMatch.index + keyMatch[0].length;
  const absoluteValueStart = weekBlockStart + valueStartInWeek;

  const parsed = parseJsStringOrTemplate(fileText, absoluteValueStart);
  if (!parsed) {
    throw new Error(`Unable to parse existing recipe value for key: ${recipeKey}`);
  }

  const replacementLiteral = menu === 'lunch'
    ? `'${encodeSingleQuotedJsString(replacementHtml)}'`
    : `\`${encodeTemplateLiteral(replacementHtml)}\``;

  return `${fileText.slice(0, parsed.start)}${replacementLiteral}${fileText.slice(parsed.end)}`;
}

function parseJsStringOrTemplate(source, index) {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i += 1;

  const quote = source[i];
  if (!quote || !['"', "'", '`'].includes(quote)) {
    return null;
  }

  const start = i;
  i += 1;

  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (quote === '`' && ch === '$' && source[i + 1] === '{') {
      i += 2;
      let depth = 1;
      while (i < source.length && depth > 0) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') depth -= 1;
        else if (source[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (ch === quote) {
      return { start, end: i + 1 };
    }
    i += 1;
  }

  return null;
}

function findMatchingBrace(source, openIndex) {
  if (openIndex < 0 || source[openIndex] !== '{') return -1;

  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return i;
  }
  return -1;
}

function generateRecipeHtml(recipeJson) {
  const title = escapeHtml(recipeJson.title || 'Untitled Recipe');
  const ingredients = Array.isArray(recipeJson.ingredients) ? recipeJson.ingredients : [];
  const steps = Array.isArray(recipeJson.steps) ? recipeJson.steps : [];

  const ingredientRows = ingredients.map((item) => {
    const qty = item.qty == null ? '' : String(item.qty);
    const unit = item.unit ? String(item.unit) : '';
    const notes = item.notes ? ` (${String(item.notes)})` : '';
    const ingredientName = `${String(item.name || '')}${notes}`.trim();
    const amount = `${qty} ${unit}`.trim();
    return `<tr><td>${escapeHtml(ingredientName)}</td><td>${escapeHtml(amount)}</td></tr>`;
  }).join('');

  const stepRows = steps.map((step) => `<li><p>${escapeHtml(String(step))}</p></li>`).join('');

  return `<h2>${title}</h2><h3>Ingredients</h3><table><thead><tr><th>Ingredient</th><th>Amount</th></tr></thead><tbody>${ingredientRows}</tbody></table><h3>Method</h3><ol type="1">${stepRows}</ol>`;
}

async function extractRecipeWithOpenAI({ apiKey, sourceUrl, readableText }) {
  const truncated = readableText.slice(0, 22000);

  const schema = {
    name: 'recipe_extraction',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        servings: { type: 'string' },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              qty: { anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }] },
              unit: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['name', 'qty', 'unit', 'notes'],
          },
        },
        steps: { type: 'array', items: { type: 'string' } },
        sourceUrl: { type: 'string' },
      },
      required: ['title', 'servings', 'ingredients', 'steps', 'sourceUrl'],
    },
  };

  const payload = {
    model: 'gpt-4.1-mini',
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: schema,
    },
    messages: [
      {
        role: 'system',
        content: 'You extract recipes from webpage text. Return only valid JSON matching schema. Preserve ingredient names and normalize qty/unit when possible. If uncertain, keep qty null and put details in notes.',
      },
      {
        role: 'user',
        content: `Source URL: ${sourceUrl}\n\nPage text:\n${truncated}`,
      },
    ],
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned no content');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI JSON: ${error.message}`);
  }

  parsed.sourceUrl = sourceUrl;
  return parsed;
}

function extractIngredientStrings(html) {
  const fromJsonLd = extractIngredientsFromJsonLd(html);
  if (fromJsonLd.length) {
    return uniqueStrings(fromJsonLd);
  }

  const fallback = [];
  const directSelectors = [
    /<[^>]*class=["'][^"']*wprm-recipe-ingredient[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
  ];
  directSelectors.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = sanitizeText(match[1] || '');
      if (text) fallback.push(text);
    }
  });

  const listContainerPatterns = [
    /<[^>]*class=["'][^"']*recipe-ingredients[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
    /<[^>]*class=["'][^"']*ingredients[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi,
  ];
  listContainerPatterns.forEach((containerPattern) => {
    let containerMatch;
    while ((containerMatch = containerPattern.exec(html)) !== null) {
      const block = containerMatch[1] || '';
      const liMatches = Array.from(block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
      liMatches.forEach((li) => {
        const text = sanitizeText(li[1] || '');
        if (text) fallback.push(text);
      });
    }
  });

  return uniqueStrings(fallback);
}

function extractIngredientsFromJsonLd(html) {
  const results = [];
  const scriptMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  scriptMatches.forEach((match) => {
    const raw = (match[1] || '').trim();
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      return;
    }
    flattenJsonLdRecipes(parsed).forEach((recipe) => {
      const list = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [];
      list.forEach((value) => {
        const text = sanitizeText(String(value || ''));
        if (text) results.push(text);
      });
    });
  });
  return results;
}

function extractRecipeTitleFromJsonLd(html) {
  const scriptMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const match of scriptMatches) {
    const raw = (match[1] || '').trim();
    if (!raw) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      continue;
    }
    const recipes = flattenJsonLdRecipes(parsed);
    for (const recipe of recipes) {
      const name = sanitizeText(String(recipe.name || ''));
      if (name) return name;
    }
  }
  return '';
}

function flattenJsonLdRecipes(value) {
  const nodes = [];
  const pushNode = (node) => {
    if (!node || typeof node !== 'object') return;
    nodes.push(node);
    if (Array.isArray(node['@graph'])) {
      node['@graph'].forEach(pushNode);
    }
  };

  if (Array.isArray(value)) value.forEach(pushNode);
  else pushNode(value);

  return nodes.filter((node) => {
    const type = node['@type'];
    if (Array.isArray(type)) return type.some((item) => String(item).toLowerCase() === 'recipe');
    return String(type || '').toLowerCase() === 'recipe';
  });
}

function parseIngredientLine(line) {
  const original = sanitizeText(String(line || ''));
  if (!original) return null;

  const fractionMap = {
    '\u00bc': 0.25,
    '\u00bd': 0.5,
    '\u00be': 0.75,
    '\u2153': 1 / 3,
    '\u2154': 2 / 3,
    '\u215b': 1 / 8,
  };
  const normalized = original.replace(/[\u00bc\u00bd\u00be\u2153\u2154\u215b]/g, (m) => ` ${fractionMap[m]} `).replace(/\s+/g, ' ').trim();
  const tokens = normalized.split(' ').filter(Boolean);

  const units = new Set([
    'tsp', 'tsps', 'teaspoon', 'teaspoons',
    'tbsp', 'tbsps', 'tablespoon', 'tablespoons',
    'cup', 'cups',
    'g', 'gram', 'grams',
    'kg', 'kilogram', 'kilograms',
    'lb', 'lbs', 'pound', 'pounds',
    'oz', 'ounce', 'ounces',
    'ml', 'milliliter', 'milliliters',
    'l', 'liter', 'liters',
    'clove', 'cloves',
    'pinch', 'pinches',
    'can', 'cans',
    'pkg', 'package', 'packages',
  ]);

  let qty = null;
  let unit = '';
  let startIndex = 0;

  if (tokens.length > 0 && /^(\d+(\.\d+)?|\d+\/\d+)$/.test(tokens[0])) {
    qty = parseQtyToken(tokens[0]);
    startIndex = 1;
    if (tokens.length > 1 && /^\d+\/\d+$/.test(tokens[1])) {
      qty += parseQtyToken(tokens[1]);
      startIndex = 2;
    }
  }

  if (tokens[startIndex] && units.has(tokens[startIndex].toLowerCase())) {
    unit = tokens[startIndex];
    startIndex += 1;
  }

  const remainder = tokens.slice(startIndex).join(' ').trim();
  const name = remainder || original;

  return {
    name,
    qty: Number.isFinite(qty) ? qty : null,
    unit: unit || '',
    notes: '',
  };
}

function parseQtyToken(token) {
  if (/^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split('/').map(Number);
    if (b) return a / b;
    return 0;
  }
  return Number(token);
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const text = sanitizeText(String(value || ''));
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
}

function normalizeRecipePayload(recipeJson) {
  const safe = recipeJson && typeof recipeJson === 'object' ? recipeJson : {};
  const ingredients = (Array.isArray(safe.ingredients) ? safe.ingredients : [])
    .map((item) => {
      if (typeof item === 'string') return parseIngredientLine(item);
      if (!item || typeof item !== 'object') return null;
      const name = sanitizeText(String(item.name || ''));
      if (!name) return null;
      return {
        name,
        qty: item.qty == null ? null : item.qty,
        unit: item.unit == null ? '' : String(item.unit),
        notes: item.notes == null ? '' : String(item.notes),
      };
    })
    .filter((item) => item && item.name);

  return {
    title: sanitizeText(String(safe.title || 'Untitled Recipe')),
    servings: sanitizeText(String(safe.servings || '')),
    ingredients,
    steps: (Array.isArray(safe.steps) ? safe.steps : []).map((step) => sanitizeText(String(step || ''))).filter(Boolean),
    sourceUrl: String(safe.sourceUrl || ''),
  };
}

function hasNonEmptyIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return false;
  return ingredients.some((item) => {
    if (typeof item === 'string') return Boolean(sanitizeText(item));
    if (item && typeof item === 'object') return Boolean(sanitizeText(String(item.name || '')));
    return false;
  });
}

function extractReadableText(html) {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  const titleMatch = noScripts.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? sanitizeText(titleMatch[1]) : '';

  const headingMatches = Array.from(noScripts.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi))
    .map((m) => sanitizeText(m[1]))
    .filter(Boolean)
    .slice(0, 30);

  const paragraphMatches = Array.from(noScripts.matchAll(/<(?:p|li|td)[^>]*>([\s\S]*?)<\/(?:p|li|td)>/gi))
    .map((m) => sanitizeText(m[1]))
    .filter(Boolean)
    .slice(0, 400);

  return [
    title ? `Title: ${title}` : '',
    headingMatches.length ? `Headings:\n- ${headingMatches.join('\n- ')}` : '',
    paragraphMatches.length ? `Content:\n${paragraphMatches.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
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
    'User-Agent': 'chef-dashboard-update-worker',
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encodeSingleQuotedJsString(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function encodeTemplateLiteral(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/\r?\n/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidRecipePayload(recipeJson) {
  return Boolean(
    recipeJson &&
    typeof recipeJson === 'object' &&
    typeof recipeJson.title === 'string' &&
    recipeJson.title.trim() &&
    Array.isArray(recipeJson.ingredients) &&
    Array.isArray(recipeJson.steps)
  );
}

function validateUpdatedRecipeFile({ menu, fileText, week, recipeKey }) {
  const expectedGlobalName = menu === 'lunch' ? 'recipesLunchData' : 'recipesData';
  const globalPattern = new RegExp(`(?:window|globalThis)\\.${expectedGlobalName}\\s*=`);
  if (!globalPattern.test(fileText)) {
    return { ok: false, error: `${expectedGlobalName} global assignment missing (window/globalThis)` };
  }

  let data;
  try {
    data = evaluateRecipeScript(fileText, menu);
  } catch (error) {
    return { ok: false, error: `Updated ${expectedGlobalName} is invalid JavaScript: ${error.message}` };
  }

  if (!hasWeekLikeRecipeData(data)) {
    return { ok: false, error: `${expectedGlobalName} structure is invalid` };
  }

  const weekData = data[String(week)] || data[week];
  if (!weekData || typeof weekData !== 'object' || Array.isArray(weekData)) {
    return { ok: false, error: `Week ${week} missing in ${expectedGlobalName}` };
  }

  if (!Object.prototype.hasOwnProperty.call(weekData, recipeKey)) {
    return { ok: false, error: `Recipe key "${recipeKey}" missing in week ${week}` };
  }

  if (typeof weekData[recipeKey] !== 'string') {
    return { ok: false, error: `Recipe value for "${recipeKey}" is not a string` };
  }

  return { ok: true };
}

function resolveRecipeKeyForWeek({ fileText, menu, week, preferredKeys }) {
  let data;
  try {
    data = evaluateRecipeScript(fileText, menu);
  } catch (_error) {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const weekData = data[String(week)] || data[week];
  if (!weekData || typeof weekData !== 'object' || Array.isArray(weekData)) return null;

  const recipeKeys = Object.keys(weekData);
  if (!recipeKeys.length) return null;

  const normalizedCandidates = (preferredKeys || [])
    .map((value) => sanitizeText(String(value || '')).toLowerCase())
    .filter(Boolean);

  for (const candidate of normalizedCandidates) {
    const exact = recipeKeys.find((key) => sanitizeText(key).toLowerCase() === candidate);
    if (exact) return exact;
  }

  for (const candidate of normalizedCandidates) {
    const includes = recipeKeys.find((key) => {
      const keyNorm = sanitizeText(key).toLowerCase();
      return keyNorm.includes(candidate) || candidate.includes(keyNorm);
    });
    if (includes) return includes;
  }

  return null;
}

function evaluateRecipeScript(fileText, menu) {
  const runtime = { module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;

  const evaluator = new Function(
    'globalThis',
    'window',
    'self',
    'module',
    'exports',
    `${fileText}
return {
  recipesData: typeof recipesData !== 'undefined' ? recipesData : undefined,
  recipesLunchData: typeof recipesLunchData !== 'undefined' ? recipesLunchData : undefined
};`
  );

  const result = evaluator(runtime, runtime, runtime, runtime.module, runtime.exports) || {};
  if (menu === 'lunch') {
    return runtime.recipesLunchData || runtime.module?.exports?.recipesLunchData || result.recipesLunchData || null;
  }
  return runtime.recipesData || result.recipesData || null;
}

function hasWeekLikeRecipeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const weekKeys = Object.keys(data).filter((key) => Number.isFinite(Number(String(key).replace(/[^\d]/g, ''))));
  if (!weekKeys.length) return false;

  return weekKeys.every((weekKey) => {
    const weekData = data[weekKey];
    if (!weekData || typeof weekData !== 'object' || Array.isArray(weekData)) return false;
    const recipeKeys = Object.keys(weekData);
    if (!recipeKeys.length) return false;
    return recipeKeys.some((recipeKey) => typeof weekData[recipeKey] === 'string');
  });
}

function requireEnv(env, keys) {
  for (const key of keys) {
    if (!env[key]) {
      throw new Error(`${key} is not configured`);
    }
  }
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}
