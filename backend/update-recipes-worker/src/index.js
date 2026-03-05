const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,x-admin-secret',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

const ADMIN_SECRET = 'abc123';

const DAY_ALIASES = {
  monday: ['Monday', 'Mon'],
  tuesday: ['Tuesday', 'Tue', 'Tues'],
  wednesday: ['Wednesday', 'Wed'],
  thursday: ['Thursday', 'Thu', 'Thur', 'Thurs'],
  friday: ['Friday', 'Fri'],
  saturday: ['Saturday', 'Sat'],
  sunday: ['Sunday', 'Sun'],
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/') {
        return json({
          ok: true,
          endpoints: ['GET /', 'POST /extract', 'POST /apply', 'POST /admin/update'],
        }, 200);
      }

      if (request.method === 'POST' && url.pathname === '/extract') {
        return await handleExtract(request);
      }

      if (request.method === 'POST' && url.pathname === '/admin/update') {
        const providedSecret = request.headers.get('x-admin-secret') || '';
        if (providedSecret !== ADMIN_SECRET) {
          return json({ ok: false, error: 'Unauthorized: invalid x-admin-secret.' }, 401);
        }

        const body = await parseJsonBody(request);
        return json({ ok: true, received: body }, 200);
      }

      if (request.method === 'POST' && url.pathname === '/apply') {
        return await handleApply(request, env);
      }

      return json({ ok: false, error: 'Endpoint not found', path: url.pathname }, 404);
    } catch (error) {
      const status = Number(error?.status) || 500;
      const details = error?.details || null;
      return json({ ok: false, error: error?.message || String(error), details }, status);
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
    headers: { 'User-Agent': 'ChefDashboardRecipeBot/3.0 (+https://github.com/)' },
  });

  if (!response.ok) {
    return json({ ok: false, error: `Failed to fetch source URL (${response.status})` }, 400);
  }

  const html = await response.text();
  const recipeNode = extractPrimaryRecipeFromJsonLd(html);
  if (!recipeNode) {
    return json({ ok: false, error: 'No Recipe JSON-LD found at URL.' }, 422);
  }

  const ingredients = extractIngredientStrings(html, recipeNode).map((line) => parseIngredientLine(line)).filter(Boolean);
  const steps = normalizeRecipeInstructions(recipeNode.recipeInstructions);
  if (!ingredients.length || !steps.length) {
    return json({ ok: false, error: 'Could not extract ingredients/steps from the URL.' }, 422);
  }

  const extractedRecipe = {
    title: sanitizeText(recipeNode.name || extractTitleFromHtml(html) || 'Untitled Recipe'),
    servings: normalizeServings(recipeNode.recipeYield),
    ingredients,
    steps,
    sourceUrl,
  };
  extractedRecipe.generatedHtml = generateRecipeHtml(extractedRecipe);

  return json({ ok: true, extractedRecipe }, 200);
}

async function handleApply(request, env) {
  if (!env.ADMIN_SECRET) {
    return json({ ok: false, error: 'Server misconfigured: ADMIN_SECRET is missing.' }, 500);
  }

  const providedSecret = request.headers.get('x-admin-secret') || '';
  if (providedSecret !== env.ADMIN_SECRET) {
    return json({ ok: false, error: 'Unauthorized: invalid x-admin-secret.' }, 401);
  }

  const missingEnv = [];
  if (!env.GH_TOKEN) missingEnv.push('GH_TOKEN');
  if (!env.GH_OWNER) missingEnv.push('GH_OWNER');
  if (!env.GH_REPO) missingEnv.push('GH_REPO');
  if (!env.GH_BRANCH) missingEnv.push('GH_BRANCH');
  if (missingEnv.length) {
    return json({
      ok: false,
      error: `Server misconfigured: missing ${missingEnv.join(', ')}`,
    }, 500);
  }

  const body = await parseJsonBody(request);
  const menu = sanitizeText(body.menu || '').toLowerCase();
  const week = Number(body.week);
  const day = normalizeDayLabel(body.day || '');
  const slotKey = sanitizeText(body.slotKey || '');
  const oldDishName = sanitizeText(body.oldDishName || '');
  const newDishName = sanitizeText(body.newDishName || '');
  const newRecipeHtml = String(body.newRecipeHtml || '').trim();

  const missing = [];
  if (!['dinner', 'lunch'].includes(menu)) missing.push('menu (dinner|lunch)');
  if (!Number.isInteger(week) || week < 1 || week > 4) missing.push('week (1-4)');
  if (!day) missing.push('day');
  if (!slotKey) missing.push('slotKey');
  if (!oldDishName) missing.push('oldDishName');
  if (!newDishName) missing.push('newDishName');
  if (!newRecipeHtml) missing.push('newRecipeHtml');
  if (missing.length) {
    return json({
      ok: false,
      error: `Invalid request. Missing/invalid: ${missing.join(', ')}`,
    }, 400);
  }

  const branch = env.GH_BRANCH;
  const menuPath = menu === 'dinner' ? 'menu_overview.js' : 'lunch_menu_data.js';
  const recipePath = menu === 'dinner' ? 'recipes.js' : 'recipeslunch.js';

  const menuFile = await githubGetFile(env, menuPath, branch);
  const recipeFile = await githubGetFile(env, recipePath, branch);

  const menuVar = menu === 'dinner' ? 'menuOverviewData' : 'lunchMenuData';
  const recipeVar = menu === 'dinner' ? 'recipesData' : 'recipesLunchData';
  const menuData = parseDataScript(menuFile.content, menuVar);
  const recipeData = parseDataScript(recipeFile.content, recipeVar);

  const weekMenuData = getMenuWeek(menuData, menu, week);
  if (!weekMenuData) {
    return json({ ok: false, error: `Week ${week} not found in ${menuPath}` }, 400);
  }
  const dayKey = findKeyCaseInsensitive(weekMenuData, day);
  if (!dayKey) {
    return json({ ok: false, error: `Day "${day}" not found in ${menuPath}` }, 400);
  }
  const dayMenu = weekMenuData[dayKey];
  if (!dayMenu || typeof dayMenu !== 'object') {
    return json({ ok: false, error: `Day "${day}" has invalid structure in ${menuPath}` }, 400);
  }
  const resolvedSlotKey = findKeyCaseInsensitive(dayMenu, slotKey);
  if (!resolvedSlotKey) {
    return json({ ok: false, error: `Slot "${slotKey}" not found in ${menuPath}` }, 400);
  }

  const menuDishBefore = sanitizeText(dayMenu[resolvedSlotKey] || '');
  dayMenu[resolvedSlotKey] = newDishName;

  const weekRecipes = recipeData[String(week)] || recipeData[week];
  if (!weekRecipes || typeof weekRecipes !== 'object') {
    return json({ ok: false, error: `Week ${week} not found in ${recipePath}` }, 400);
  }

  const recipeKeyBefore = resolveRecipeKey(weekRecipes, [oldDishName, menuDishBefore, newDishName]);
  if (!recipeKeyBefore) {
    return json({
      ok: false,
      error: `Could not find recipe entry in ${recipePath} for oldDishName="${oldDishName}"`,
      candidatesChecked: [oldDishName, menuDishBefore, newDishName],
    }, 400);
  }

  if (recipeKeyBefore !== newDishName) {
    delete weekRecipes[recipeKeyBefore];
  }
  weekRecipes[newDishName] = newRecipeHtml;

  const menuScript = serializeMenuScript(menu, menuData);
  const recipeScript = serializeRecipeScript(menu, recipeData);
  const isDryRun = new URL(request.url).searchParams.get('dryRun') === 'true';

  if (isDryRun) {
    return json({
      ok: true,
      dryRun: true,
      menuPath,
      recipePath,
      menuUpdate: {
        week,
        day: dayKey,
        slotKey: resolvedSlotKey,
        before: menuDishBefore,
        after: newDishName,
      },
      recipeUpdate: {
        week,
        beforeKey: recipeKeyBefore,
        afterKey: newDishName,
      },
    }, 200);
  }

  const recipeCommit = await githubUpdateFile(env, {
    path: recipePath,
    branch,
    message: `Update recipe HTML: ${menu} W${week} ${dayKey} ${resolvedSlotKey}`,
    content: recipeScript,
    sha: recipeFile.sha,
  });

  const menuCommit = await githubUpdateFile(env, {
    path: menuPath,
    branch,
    message: `Update menu slot title: ${menu} W${week} ${dayKey} ${resolvedSlotKey}`,
    content: menuScript,
    sha: menuFile.sha,
  });

  return json({
    ok: true,
    status: 'updated',
    menuPath,
    recipePath,
    menuCommitSha: menuCommit.commit?.sha || null,
    recipeCommitSha: recipeCommit.commit?.sha || null,
    recipeCommitUrl: recipeCommit.commit?.html_url || null,
    menuCommitUrl: menuCommit.commit?.html_url || null,
  }, 200);
}

function parseDataScript(scriptText, varName) {
  // Supports:
  //  - const menuOverviewData = {...};
  //  - let/var menuOverviewData = {...};
  //  - export const menuOverviewData = {...};
  //  - menuOverviewData = {...};
  //
  // It does NOT execute code. It only extracts the object literal and JSON-parses it.

  const patterns = [
    new RegExp(`export\\s+const\\s+${escapeRegExp(varName)}\\s*=\\s*\\{`, 'm'),
    new RegExp(`const\\s+${escapeRegExp(varName)}\\s*=\\s*\\{`, 'm'),
    new RegExp(`let\\s+${escapeRegExp(varName)}\\s*=\\s*\\{`, 'm'),
    new RegExp(`var\\s+${escapeRegExp(varName)}\\s*=\\s*\\{`, 'm'),
    new RegExp(`${escapeRegExp(varName)}\\s*=\\s*\\{`, 'm'),
  ];

  let startIndex = -1;

  for (const re of patterns) {
    const match = re.exec(scriptText);
    if (match) {
      // index points at start of match, we need the first "{"
      const bracePos = scriptText.indexOf('{', match.index);
      if (bracePos !== -1) {
        startIndex = bracePos;
        break;
      }
    }
  }

  if (startIndex === -1) {
    throw createError(400, `Could not find ${varName} assignment in script`);
  }

  const endIndex = findMatchingBrace(scriptText, startIndex);
  if (endIndex === -1) {
    throw createError(400, `Could not parse ${varName}: unmatched braces`);
  }

  const objectLiteral = scriptText.slice(startIndex, endIndex + 1);

  // Your menu_overview.js looks JSON-safe already (double quotes everywhere),
  // so JSON.parse will work.
  // If later you have trailing commas, you’ll need a sanitizer.
  let value;
  try {
    value = JSON.parse(objectLiteral);
  } catch (err) {
    throw createError(400, `Could not JSON-parse ${varName}. Ensure it uses double quotes and no trailing commas.`);
  }

  if (!value || typeof value !== 'object') {
    throw createError(400, `Parsed ${varName} is not an object`);
  }

  return value;
}

function findMatchingBrace(text, openBraceIndex) {
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escape = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        stringQuote = ch;
        continue;
      }
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMenuWeek(menuData, menu, week) {
  if (menu === 'lunch') return menuData[`Week ${week}`] || null;
  return menuData[String(week)] || menuData[week] || null;
}

function resolveRecipeKey(weekRecipes, candidates) {
  const keys = Object.keys(weekRecipes);
  const normalizedKeys = keys.map((key) => ({ raw: key, normalized: normalizeToken(key) }));
  const normalizedCandidates = candidates.map((value) => normalizeToken(value)).filter(Boolean);

  for (const candidate of normalizedCandidates) {
    const exact = normalizedKeys.find((entry) => entry.normalized === candidate);
    if (exact) return exact.raw;
  }

  for (const candidate of normalizedCandidates) {
    const partial = normalizedKeys.find((entry) => entry.normalized.includes(candidate) || candidate.includes(entry.normalized));
    if (partial) return partial.raw;
  }

  return '';
}

function findKeyCaseInsensitive(obj, target) {
  if (!obj || typeof obj !== 'object') return '';
  const wanted = normalizeToken(target);
  if (!wanted) return '';
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += 1) {
    if (normalizeToken(keys[i]) === wanted) return keys[i];
  }
  return '';
}

function serializeRecipeScript(menu, data) {
  if (menu === 'lunch') {
    return (
      `const recipesLunchData = ${JSON.stringify(data, null, 2)};\n\n` +
      `if (typeof window !== 'undefined') {\n  window.recipesLunchData = recipesLunchData;\n}\n\n` +
      `if (typeof globalThis !== 'undefined') {\n  globalThis.recipesLunchData = recipesLunchData;\n}\n`
    );
  }

  return (
    `const recipesData = ${JSON.stringify(data, null, 2)};\n\n` +
    `if (typeof window !== 'undefined') {\n  window.recipesData = recipesData;\n}\n\n` +
    `if (typeof globalThis !== 'undefined') {\n  globalThis.recipesData = recipesData;\n}\n`
  );
}

function serializeMenuScript(menu, data) {
  if (menu === 'lunch') {
    return `const lunchMenuData = ${JSON.stringify(data, null, 2)};\n\nglobalThis.lunchMenuData = lunchMenuData;\n`;
  }
  return `const menuOverviewData = ${JSON.stringify(data, null, 2)};\n\nglobalThis.menuOverviewData = menuOverviewData;\n`;
}

function normalizeDayLabel(day) {
  const normalized = sanitizeText(day).toLowerCase();
  if (!normalized) return '';
  const aliases = DAY_ALIASES[normalized];
  if (aliases && aliases.length) return aliases[0];
  if (normalized.length === 1) return normalized.toUpperCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
      if (typeof node.text === 'string') pushStep(node.text);
      if (node.itemListElement) walk(node.itemListElement);
    }
  };

  walk(value);
  return out;
}

function normalizeServings(value) {
  if (Array.isArray(value)) return sanitizeText(value[0] || '');
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

  return {
    name: normalized,
    qty: null,
    unit: '',
    notes: '',
  };
}

function generateRecipeHtml(recipe) {
  const title = escapeHtml(recipe.title || 'Untitled Recipe');
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];

  const ingredientRows = ingredients.map((item) => {
    const name = escapeHtml(sanitizeText(item?.name || item || ''));
    const qty = item?.qty == null ? '' : String(item.qty);
    const unit = sanitizeText(item?.unit || '');
    const amount = escapeHtml(`${qty} ${unit}`.trim());
    return `<tr><td>${name}</td><td>${amount}</td></tr>`;
  }).join('');

  const stepRows = steps.map((step) => `<li><p>${escapeHtml(step)}</p></li>`).join('');
  return `<h2>${title}</h2><h3>Ingredients</h3><table><thead><tr><th>Ingredient</th><th>Amount</th></tr></thead><tbody>${ingredientRows}</tbody></table><h3>Method</h3><ol type="1">${stepRows}</ol>`;
}

function extractPrimaryRecipeFromJsonLd(html) {
  const scripts = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (let i = 0; i < scripts.length; i += 1) {
    const raw = (scripts[i][1] || '').trim();
    if (!raw) continue;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      continue;
    }

    const recipes = flattenJsonLdRecipes(parsed);
    if (recipes.length) return recipes[0];
  }
  return null;
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
    if (Array.isArray(node['@graph'])) node['@graph'].forEach(walk);
    if (node.mainEntity) walk(node.mainEntity);
    if (node.itemListElement) walk(node.itemListElement);
  };

  walk(value);

  return nodes.filter((node) => {
    const type = node['@type'];
    if (Array.isArray(type)) {
      return type.some((item) => String(item).toLowerCase() === 'recipe');
    }
    return String(type || '').toLowerCase() === 'recipe';
  });
}

function extractIngredientStrings(html, recipeNode) {
  const values = [];

  if (Array.isArray(recipeNode?.recipeIngredient)) {
    recipeNode.recipeIngredient.forEach((line) => {
      const text = sanitizeText(line);
      if (text) values.push(text);
    });
  }

  if (values.length) return uniqueStrings(values);

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

function extractTitleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? sanitizeText(match[1]) : '';
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

function normalizeToken(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
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
  const endpoint = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(endpoint, {
    headers: githubHeaders(env.GH_TOKEN),
  });

  if (!response.ok) {
    const text = await response.text();
    throw createError(response.status, `GitHub read failed for ${filePath}`, text);
  }

  const data = await response.json();
  return {
    sha: data.sha,
    content: decodeBase64(data.content || ''),
  };
}

async function githubUpdateFile(env, { path, branch, message, content, sha }) {
  const endpoint = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/contents/${path}`;
  const payload = {
    message,
    branch,
    sha,
    content: encodeBase64(content),
  };

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: githubHeaders(env.GH_TOKEN),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw createError(response.status, `GitHub write failed for ${path}`, text);
  }

  return response.json();
}

function githubHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'chef-dashboard-update-worker-v3',
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
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      throw new Error('Request body must be a JSON object');
    }
    return body;
  } catch (_error) {
    throw createError(400, 'Invalid JSON request body');
  }
}

function createError(status, message, details = null) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}
