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
const BUILD = 'index.js-build-2026-03-05-a';

const DAY_ALIASES = {
  monday: ['Monday', 'Mon'],
  tuesday: ['Tuesday', 'Tue', 'Tues'],
  wednesday: ['Wednesday', 'Wed'],
  thursday: ['Thursday', 'Thu', 'Thur', 'Thurs'],
  friday: ['Friday', 'Fri'],
  saturday: ['Saturday', 'Sat'],
  sunday: ['Sunday', 'Sun'],
};

const ALLOWED_UPDATE_PATHS = new Set([
  'data/recipes.json',
  'data/recipes_lunch.json',
  'data/ingredients.json',
  'data/menu.json',
]);

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/') {
        return json({
          ok: true,
          build: BUILD,
          endpoints: ['GET /', 'POST /extract', 'POST /apply', 'POST /admin/update'],
        }, 200);
      }

      if (request.method === 'POST' && url.pathname === '/extract') {
        return await handleExtract(request);
      }

      if (request.method === 'POST' && url.pathname === '/admin/update') {
        return await handleAdminUpdate(request, env);
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

async function handleAdminUpdate(request, env) {
  const providedSecret = request.headers.get('x-admin-secret') || '';
  if (providedSecret !== ADMIN_SECRET) {
    return json({ ok: false, error: 'Unauthorized: invalid x-admin-secret.' }, 401);
  }

  const body = await parseJsonBody(request);
  if (!env.GH_TOKEN) {
    throw createError(500, 'Server misconfigured: GH_TOKEN is missing.');
  }
  if (!env.GH_OWNER || !env.GH_REPO) {
    throw createError(500, 'Server misconfigured: GH_OWNER and GH_REPO are required.');
  }

  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (!updates.length) {
    return json({ ok: false, error: 'Body must include updates: [{ path, content }, ...]' }, 400);
  }

  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;
  const branch = env.GH_BRANCH || 'main';
  const messagePrefix = sanitizeText(body.message || '');
  const results = [];

  for (let i = 0; i < updates.length; i += 1) {
    const update = updates[i] || {};
    const path = sanitizeText(update.path || '');
    const content = typeof update.content === 'string' ? update.content : null;

    if (!path) {
      return json({ ok: false, error: `updates[${i}].path must be a non-empty string` }, 400);
    }
    if (content == null) {
      return json({ ok: false, error: `updates[${i}].content must be a string` }, 400);
    }
    if (!ALLOWED_UPDATE_PATHS.has(path)) {
      return json({ ok: false, error: `updates[${i}].path must target centralized JSON files only` }, 400);
    }

    const commitMessage = messagePrefix || `Update ${path}`;
    const result = await upsertGithubFile(env, {
      owner,
      repo,
      branch,
      path,
      contentText: content,
      message: commitMessage,
    });
    results.push(result);
  }

  return json({ ok: true, updates: results }, 200);
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
  const menuPath = 'data/menu.json';
  const ingredientsPath = 'data/ingredients.json';
  const recipePath = menu === 'dinner' ? 'data/recipes.json' : 'data/recipes_lunch.json';

  const menuFile = await githubGetFile(env, menuPath, branch);
  const recipeFile = await githubGetFile(env, recipePath, branch);
  const ingredientsFile = await githubGetFile(env, ingredientsPath, branch);

  let menuData;
  let recipeData;
  let ingredientsData;
  try {
    menuData = parseMenuJsonFile(menuFile.content, menuPath);
    recipeData = parseRecipeJsonFile(recipeFile.content, recipePath).dataObject;
    ingredientsData = parseIngredientsJsonFile(ingredientsFile.content, ingredientsPath);
  } catch (error) {
    throw createError(400, error.message || String(error));
  }

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
  weekRecipes[newDishName] = newRecipeHtml;

  const nextIngredientsData = {
    ...ingredientsData,
    menu: menu === 'dinner'
      ? buildDinnerIngredientMenu(menuData.dinner || {}, recipeData, ingredientsData.menu)
      : ingredientsData.menu,
  };

  const menuScript = serializeMenuJsonFile(menuData);
  const recipeScript = serializeRecipeJsonFile(recipeData);
  const ingredientsScript = serializeIngredientsJsonFile(nextIngredientsData);
  const recipeValidation = validateRecipeJsonFile(recipeScript, recipePath);
  if (!recipeValidation.ok) {
    return json({ ok: false, error: recipeValidation.error }, 422);
  }
  const menuValidation = validateMenuJsonFile(menuScript, menuPath);
  if (!menuValidation.ok) {
    return json({ ok: false, error: menuValidation.error }, 422);
  }
  const ingredientsValidation = validateIngredientsJsonFile(ingredientsScript, ingredientsPath);
  if (!ingredientsValidation.ok) {
    return json({ ok: false, error: ingredientsValidation.error }, 422);
  }
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
        matchedExistingKey: recipeKeyBefore || null,
        afterKey: newDishName,
        appended: recipeKeyBefore !== newDishName,
      },
      ingredientsPath,
    }, 200);
  }

  const recipeCommit = await githubUpdateFile(env, {
    path: recipePath,
    branch,
    message: `Append recipe HTML: ${menu} W${week} ${dayKey} ${resolvedSlotKey}`,
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

  const ingredientsCommit = await githubUpdateFile(env, {
    path: ingredientsPath,
    branch,
    message: `Refresh ingredient data after ${menu} W${week} ${dayKey} ${resolvedSlotKey}`,
    content: ingredientsScript,
    sha: ingredientsFile.sha,
  });

  return json({
    ok: true,
    status: 'updated',
    menuPath,
    recipePath,
    ingredientsPath,
    menuCommitSha: menuCommit.commit?.sha || null,
    recipeCommitSha: recipeCommit.commit?.sha || null,
    ingredientsCommitSha: ingredientsCommit.commit?.sha || null,
    recipeCommitUrl: recipeCommit.commit?.html_url || null,
    menuCommitUrl: menuCommit.commit?.html_url || null,
    ingredientsCommitUrl: ingredientsCommit.commit?.html_url || null,
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

  const startIndex = findObjectAssignmentStart(scriptText, varName);

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
  } catch (_strictParseErr) {
    try {
      const normalizedJson = normalizeJsObjectLiteralToJson(objectLiteral);
      value = JSON.parse(normalizedJson);
    } catch (_looseParseErr) {
      throw createError(
        400,
        `Could not parse ${varName}. Supported assignments: const/let/var/export/window/globalThis with JSON-like object literal.`,
      );
    }
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
      if (ch === '"' || ch === "'" || ch === '`') {
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

function updateObjectAssignmentInScript(scriptText, varName, value) {
  const startIndex = findObjectAssignmentStart(scriptText, varName);
  if (startIndex === -1) {
    throw createError(400, `Could not find ${varName} assignment in script`);
  }

  const endIndex = findMatchingBrace(scriptText, startIndex);
  if (endIndex === -1) {
    throw createError(400, `Could not parse ${varName}: unmatched braces`);
  }

  const replacement = JSON.stringify(value, null, 2);
  return `${scriptText.slice(0, startIndex)}${replacement}${scriptText.slice(endIndex + 1)}`;
}

function validateScriptSyntax(scriptText, label) {
  try {
    new Function(scriptText);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Invalid JavaScript for ${label}: ${error.message || String(error)}` };
  }
}

function findObjectAssignmentStart(scriptText, varName) {
  const target = escapeRegExp(varName);
  const patterns = [
    new RegExp(`export\\s+const\\s+${target}\\s*=\\s*\\{`, 'm'),
    new RegExp(`const\\s+${target}\\s*=\\s*\\{`, 'm'),
    new RegExp(`let\\s+${target}\\s*=\\s*\\{`, 'm'),
    new RegExp(`var\\s+${target}\\s*=\\s*\\{`, 'm'),
    new RegExp(`window\\.${target}\\s*=\\s*\\{`, 'm'),
    new RegExp(`globalThis\\.${target}\\s*=\\s*\\{`, 'm'),
    new RegExp(`${target}\\s*=\\s*\\{`, 'm'),
  ];

  for (const re of patterns) {
    const match = re.exec(scriptText);
    if (!match) continue;
    const bracePos = scriptText.indexOf('{', match.index);
    if (bracePos !== -1) return bracePos;
  }

  return -1;
}

function parseRecipeJsonFile(fileText, filePath) {
  let dataObject;
  try {
    dataObject = JSON.parse(fileText);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message || String(error)}`);
  }

  if (!dataObject || typeof dataObject !== 'object' || Array.isArray(dataObject)) {
    throw new Error(`${filePath} must contain an object`);
  }

  return { dataObject };
}

function parseMenuJsonFile(fileText, filePath) {
  let dataObject;
  try {
    dataObject = JSON.parse(fileText);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message || String(error)}`);
  }

  if (!dataObject || typeof dataObject !== 'object' || Array.isArray(dataObject)) {
    throw new Error(`${filePath} must contain an object`);
  }
  if (!dataObject.dinner || typeof dataObject.dinner !== 'object') {
    throw new Error(`${filePath} is missing a dinner object`);
  }
  if (!dataObject.lunch || typeof dataObject.lunch !== 'object') {
    throw new Error(`${filePath} is missing a lunch object`);
  }

  return dataObject;
}

function parseIngredientsJsonFile(fileText, filePath) {
  let dataObject;
  try {
    dataObject = JSON.parse(fileText);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message || String(error)}`);
  }

  if (!dataObject || typeof dataObject !== 'object' || Array.isArray(dataObject)) {
    throw new Error(`${filePath} must contain an object`);
  }

  return {
    ...dataObject,
    menu: Array.isArray(dataObject.menu) ? dataObject.menu : [],
    masterIngredients: Array.isArray(dataObject.masterIngredients) ? dataObject.masterIngredients : [],
  };
}

function serializeRecipeJsonFile(dataObject) {
  return `${JSON.stringify(dataObject, null, 2)}\n`;
}

function serializeMenuJsonFile(dataObject) {
  return `${JSON.stringify(dataObject, null, 2)}\n`;
}

function serializeIngredientsJsonFile(dataObject) {
  return `${JSON.stringify(dataObject, null, 2)}\n`;
}

function validateRecipeJsonFile(fileText, filePath) {
  try {
    const parsed = parseRecipeJsonFile(fileText, filePath);
    const weekKeys = Object.keys(parsed.dataObject || {}).filter((key) => /^\d+$/.test(String(key)));
    if (!weekKeys.length) {
      return { ok: false, error: `${filePath} has no valid numeric week keys` };
    }
    for (let i = 0; i < weekKeys.length; i += 1) {
      const weekKey = weekKeys[i];
      const weekRecipes = parsed.dataObject[weekKey];
      if (!weekRecipes || typeof weekRecipes !== 'object' || Array.isArray(weekRecipes)) {
        return { ok: false, error: `${filePath} week ${weekKey} must be an object` };
      }
      const recipeKeys = Object.keys(weekRecipes);
      if (!recipeKeys.length) {
        return { ok: false, error: `${filePath} week ${weekKey} must contain recipes` };
      }
      for (let j = 0; j < recipeKeys.length; j += 1) {
        const recipeKey = recipeKeys[j];
        const html = normalizeStoredRecipeHtml(weekRecipes[recipeKey]);
        if (!html) {
          return { ok: false, error: `${filePath} recipe "${recipeKey}" must be a non-empty HTML string` };
        }
        if (!/<h2[\s>]/i.test(html) || (!/<h3[^>]*>\s*Ingredients\s*<\/h3>/i.test(html) && !/<table[\s>]/i.test(html))) {
          return { ok: false, error: `${filePath} recipe "${recipeKey}" is missing required recipe sections` };
        }
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function validateMenuJsonFile(fileText, filePath) {
  try {
    parseMenuJsonFile(fileText, filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function validateIngredientsJsonFile(fileText, filePath) {
  try {
    parseIngredientsJsonFile(fileText, filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function parseRecipeScript(fileText, menu) {
  const expectedGlobal = menu === 'dinner' ? 'recipesData' : 'recipesLunchData';
  const label = menu === 'dinner' ? 'recipes.js' : 'recipeslunch.js';
  const syntax = validateScriptSyntax(fileText, label);
  if (!syntax.ok) {
    throw new Error(syntax.error);
  }

  const evaluated = evaluateRecipeScript(fileText, label);
  const dataObject =
    evaluated.runtime?.window?.[expectedGlobal] ||
    evaluated.runtime?.globalThis?.[expectedGlobal] ||
    evaluated.locals?.[expectedGlobal] ||
    null;

  if (!dataObject || typeof dataObject !== 'object' || Array.isArray(dataObject)) {
    throw new Error(`${expectedGlobal} is missing or is not an object in ${label}`);
  }

  return { dataObject };
}

function evaluateRecipeScript(scriptText, label) {
  const runtime = { window: {}, globalThis: {}, self: {}, module: { exports: {} }, exports: {} };
  runtime.globalThis = runtime;
  runtime.window = runtime;
  runtime.self = runtime;

  try {
    const fn = new Function(
      'window',
      'globalThis',
      'self',
      'module',
      'exports',
      `${scriptText}
return {
  recipesData: typeof recipesData !== 'undefined' ? recipesData : undefined,
  recipesLunchData: typeof recipesLunchData !== 'undefined' ? recipesLunchData : undefined,
};`
    );

    const locals = fn(runtime, runtime, runtime, runtime.module, runtime.exports) || {};
    return { runtime, locals };
  } catch (error) {
    throw new Error(`Unable to evaluate ${label}: ${error.message || String(error)}`);
  }
}

function validateRecipeScript(scriptText, menu) {
  const expectedGlobal = menu === 'dinner' ? 'recipesData' : 'recipesLunchData';
  const label = menu === 'dinner' ? 'recipes.js' : 'recipeslunch.js';

  try {
    const parsed = parseRecipeScript(scriptText, menu);
    if (!Object.keys(parsed.dataObject || {}).length) {
      return { ok: false, error: `${expectedGlobal} is empty in ${label}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

function normalizeJsObjectLiteralToJson(jsLiteral) {
  let out = '';
  let inString = false;
  let quote = '';
  let escape = false;

  for (let i = 0; i < jsLiteral.length; i += 1) {
    const ch = jsLiteral[i];

    if (!inString) {
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        quote = ch;
        out += '"';
        continue;
      }
      out += ch;
      continue;
    }

    if (escape) {
      out += jsonEscapeChar(ch);
      escape = false;
      continue;
    }

    if (ch === '\\') {
      escape = true;
      continue;
    }

    if (quote === '`' && ch === '$' && jsLiteral[i + 1] === '{') {
      throw new Error('Template interpolation is not supported');
    }

    if (ch === quote) {
      inString = false;
      quote = '';
      out += '"';
      continue;
    }

    if (ch === '\n') {
      out += '\\n';
      continue;
    }
    if (ch === '\r') {
      out += '\\r';
      continue;
    }
    if (ch === '\t') {
      out += '\\t';
      continue;
    }
    if (ch === '"') {
      out += '\\"';
      continue;
    }

    out += ch;
  }

  if (inString || escape) {
    throw new Error('Unterminated string in object literal');
  }

  const withoutTrailingCommas = out.replace(/,\s*([}\]])/g, '$1');
  return withoutTrailingCommas.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*|\d+)\s*:/g, '$1"$2":');
}

function jsonEscapeChar(ch) {
  if (ch === '\n') return '\\n';
  if (ch === '\r') return '\\r';
  if (ch === '\t') return '\\t';
  if (ch === '"') return '\\"';
  if (ch === '\\') return '\\\\';
  return `\\${ch}`;
}

function getMenuWeek(menuData, menu, week) {
  const branch = menu === 'lunch' ? menuData.lunch : menuData.dinner;
  if (!branch || typeof branch !== 'object') return null;
  if (menu === 'lunch') return branch[`Week ${week}`] || null;
  return branch[String(week)] || branch[week] || null;
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

function normalizeStoredRecipeHtml(recipeValue) {
  if (typeof recipeValue === 'string') return recipeValue.trim();
  if (recipeValue && typeof recipeValue === 'object') {
    if (typeof recipeValue.generatedHtml === 'string') return recipeValue.generatedHtml.trim();
    if (typeof recipeValue.recipeHtml === 'string') return recipeValue.recipeHtml.trim();
  }
  return '';
}

function parseIngredientsFromRecipeHtml(recipeHtml) {
  const rows = [];
  if (!recipeHtml || typeof recipeHtml !== 'string') return rows;

  const trMatches = recipeHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  trMatches.forEach((row) => {
    const tdMatches = row.match(/<td[\s\S]*?<\/td>/gi) || [];
    if (tdMatches.length < 2) return;
    const ingredientName = sanitizeText(tdMatches[0]);
    if (!ingredientName || /^ingredient$/i.test(ingredientName)) return;
    const amount = parseQuantityAndUnit(tdMatches[1]);
    rows.push({ name: ingredientName, quantity: amount.quantity, unit: amount.unit });
  });

  return rows;
}

function parseQuantityAndUnit(value) {
  const cleaned = sanitizeText(value).replace(/,/g, '.');
  if (!cleaned) return { quantity: null, unit: '' };

  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { quantity: null, unit: cleaned };

  return {
    quantity: Number(match[1]),
    unit: sanitizeText(match[2] || ''),
  };
}

function buildCategoryLookup(currentIngredientMenu) {
  const lookup = {};
  const menuEntries = Array.isArray(currentIngredientMenu) ? currentIngredientMenu : [];

  menuEntries.forEach((entry) => {
    if (!entry || !entry.categories) return;
    ['produce', 'protein', 'dairy', 'dry', 'other'].forEach((category) => {
      const items = Array.isArray(entry.categories[category]) ? entry.categories[category] : [];
      items.forEach((item) => {
        const name = item && typeof item === 'object' ? item.name : item;
        const key = normalizeToken(name);
        if (key && !lookup[key]) lookup[key] = category;
      });
    });
  });

  return lookup;
}

function buildDinnerIngredientMenu(dinnerMenuData, dinnerRecipes, currentIngredientMenu) {
  if (!dinnerRecipes || typeof dinnerRecipes !== 'object') return Array.isArray(currentIngredientMenu) ? currentIngredientMenu : [];

  const categoryLookup = buildCategoryLookup(currentIngredientMenu);
  const generatedMenu = [];

  Object.keys(dinnerMenuData || {}).forEach((weekKey) => {
    const weekNumber = Number(weekKey);
    const weekDays = dinnerMenuData[weekKey];
    if (!weekDays || typeof weekDays !== 'object') return;

    Object.keys(weekDays).forEach((day) => {
      const categories = { produce: [], protein: [], dairy: [], dry: [], other: [] };
      const seenByCategory = { produce: new Set(), protein: new Set(), dairy: new Set(), dry: new Set(), other: new Set() };
      const dayMenu = weekDays[day];
      const weekRecipes = dinnerRecipes[weekKey] || {};

      Object.keys(dayMenu || {}).forEach((slotKey) => {
        const dishName = sanitizeText(dayMenu[slotKey] || '');
        if (!dishName || /^(n\/a|add alternative)$/i.test(dishName)) return;

        const recipeKey = resolveRecipeKey(weekRecipes, [dishName]);
        if (!recipeKey) return;

        const recipeHtml = normalizeStoredRecipeHtml(weekRecipes[recipeKey]);
        parseIngredientsFromRecipeHtml(recipeHtml).forEach((ingredient) => {
          const ingredientName = sanitizeText(ingredient.name || '');
          if (!ingredientName) return;

          const normalized = normalizeToken(ingredientName);
          if (!normalized) return;

          const category = categoryLookup[normalized] || 'other';
          if (seenByCategory[category].has(normalized)) return;

          seenByCategory[category].add(normalized);
          categories[category].push({
            name: ingredientName,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        });
      });

      generatedMenu.push({ week: weekNumber, day, categories });
    });
  });

  return generatedMenu;
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

function b64EncodeUnicode(value) {
  const utf8 = new TextEncoder().encode(String(value));
  let binary = '';
  for (let i = 0; i < utf8.length; i += 1) {
    binary += String.fromCharCode(utf8[i]);
  }
  return btoa(binary);
}

async function githubApi(env, method, url, bodyObj = null) {
  if (!env.GH_TOKEN) {
    throw createError(500, 'Server misconfigured: GH_TOKEN is missing.');
  }

  const init = {
    method,
    headers: {
      'Authorization': `Bearer ${env.GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'chef-dashboard-update-worker-admin-update',
    },
  };

  if (bodyObj != null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(bodyObj);
  }

  const response = await fetch(url, init);
  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = { raw: text };
  }

  if (!response.ok) {
    const err = createError(response.status, `GitHub API request failed (${response.status})`);
    err.details = data;
    throw err;
  }

  return data;
}

async function getGithubFileSha(env, { owner, repo, path, branch }) {
  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;

  try {
    const data = await githubApi(env, 'GET', endpoint);
    return data?.sha || null;
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
}

async function githubCommitFilesAtomically(env, { branch, message, files }) {
  const owner = env.GH_OWNER;
  const repo = env.GH_REPO;
  const refName = `heads/${branch}`;
  const refEndpoint = `https://api.github.com/repos/${owner}/${repo}/git/ref/${refName}`;
  const refData = await githubApi(env, 'GET', refEndpoint);
  const parentSha = refData?.object?.sha;
  if (!parentSha) {
    throw createError(500, `Could not resolve git ref for branch ${branch}`);
  }

  const commitEndpoint = `https://api.github.com/repos/${owner}/${repo}/git/commits/${parentSha}`;
  const parentCommit = await githubApi(env, 'GET', commitEndpoint);
  const baseTreeSha = parentCommit?.tree?.sha;
  if (!baseTreeSha) {
    throw createError(500, `Could not resolve base tree for branch ${branch}`);
  }

  const treeEndpoint = `https://api.github.com/repos/${owner}/${repo}/git/trees`;
  const treeData = await githubApi(env, 'POST', treeEndpoint, {
    base_tree: baseTreeSha,
    tree: files.map((file) => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.content,
    })),
  });

  const newTreeSha = treeData?.sha;
  if (!newTreeSha) {
    throw createError(500, 'Could not create git tree for recipe update');
  }

  const createCommitEndpoint = `https://api.github.com/repos/${owner}/${repo}/git/commits`;
  const createdCommit = await githubApi(env, 'POST', createCommitEndpoint, {
    message,
    tree: newTreeSha,
    parents: [parentSha],
  });

  const newCommitSha = createdCommit?.sha;
  if (!newCommitSha) {
    throw createError(500, 'Could not create git commit for recipe update');
  }

  await githubApi(env, 'PATCH', refEndpoint, {
    sha: newCommitSha,
    force: false,
  });

  return {
    commitSha: newCommitSha,
    commitUrl: createdCommit?.html_url || `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
  };
}

async function upsertGithubFile(env, { owner, repo, path, branch, contentText, message }) {
  const sha = await getGithubFileSha(env, { owner, repo, path, branch });
  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const payload = {
    message,
    branch,
    content: b64EncodeUnicode(contentText),
  };
  if (sha) payload.sha = sha;

  const data = await githubApi(env, 'PUT', endpoint, payload);
  return {
    path,
    sha,
    commitSha: data?.commit?.sha || null,
    commitUrl: data?.commit?.html_url || null,
    contentUrl: data?.content?.html_url || null,
  };
}
