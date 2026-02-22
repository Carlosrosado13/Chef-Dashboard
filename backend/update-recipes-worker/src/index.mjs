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

      return json({ error: 'Not found' }, 404);
    } catch (error) {
      return json({ error: error.message || String(error) }, 500);
    }
  },
};

async function handleExtract(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY is not configured' }, 500);
  }

  const body = await parseJsonBody(request);
  const sourceUrl = String(body.url || '').trim();
  if (!sourceUrl) {
    return json({ error: 'url is required' }, 400);
  }

  const pageResponse = await fetch(sourceUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'ChefDashboardRecipeBot/1.0 (+https://github.com/)'
    }
  });

  if (!pageResponse.ok) {
    return json({ error: `Failed to fetch source URL (${pageResponse.status})` }, 400);
  }

  const html = await pageResponse.text();
  const readable = extractReadableText(html);

  const extracted = await extractRecipeWithOpenAI({
    apiKey: env.OPENAI_API_KEY,
    sourceUrl,
    readableText: readable,
  });

  return json(extracted, 200);
}

async function handleApply(request, env) {
  requireEnv(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);

  const providedSecret = request.headers.get('x-admin-secret') || '';
  if (!env.ADMIN_SECRET || providedSecret !== env.ADMIN_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const body = await parseJsonBody(request);
  const menu = String(body.menu || '').toLowerCase();
  const week = Number(body.week);
  const day = String(body.day || '').trim();
  const dishId = String(body.dishId || '').trim();
  const dishSlot = String(body.dishSlot || '').trim();
  const dishName = String(body.dishName || '').trim();
  const recipeKey = String(body.recipeKey || '').trim();
  const recipeJson = body.recipeJson;

  if (!['lunch', 'dinner'].includes(menu)) {
    return json({ error: 'menu must be lunch or dinner' }, 400);
  }
  if (!Number.isInteger(week) || week < 1 || week > 4) {
    return json({ error: 'week must be 1..4' }, 400);
  }
  if (!day || !dishId || !recipeKey || !recipeJson || typeof recipeJson !== 'object') {
    return json({ error: 'day, dishId, recipeKey, recipeJson are required' }, 400);
  }

  const targetPath = menu === 'lunch' ? 'recipeslunch.js' : 'recipes.js';
  const generatedHtml = generateRecipeHtml(recipeJson);

  const branch = env.GITHUB_BRANCH || 'main';
  const fileInfo = await githubGetFile(env, targetPath, branch);
  const updatedContent = replaceRecipeEntry({
    fileText: fileInfo.content,
    week,
    recipeKey,
    menu,
    replacementHtml: generatedHtml,
  });

  if (updatedContent === fileInfo.content) {
    return json({ error: 'No change detected for selected recipe entry' }, 400);
  }

  const commitMessage = `Update ${menu} week ${week} ${day} ${dishSlot || dishName || dishId}`;
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
    commitUrl: commit.commit?.html_url || null,
    path: targetPath,
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
