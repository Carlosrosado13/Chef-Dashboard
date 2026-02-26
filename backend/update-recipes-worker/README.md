# Update Recipes Worker (Cloudflare)

This worker provides admin endpoints for the static Chef Dashboard frontend:

- `POST /extract`
- `POST /apply`
- `POST /api/dispatchPatch`
- `POST /api/applyPatch` (back-compat alias)

## Endpoints

### `POST /extract`
Request body:

```json
{ "url": "https://example.com/recipe" }
```

Behavior:
- Fetches the recipe page server-side.
- Extracts readable text.
- Calls OpenAI with strict JSON schema output.
- Returns:

```json
{
  "title": "...",
  "servings": "...",
  "ingredients": [{"name":"...","qty":1,"unit":"cup","notes":""}],
  "steps": ["..."],
  "sourceUrl": "https://..."
}
```

### `POST /apply`
Headers:
- `x-admin-secret: <ADMIN_SECRET>`

Request body:

```json
{
  "menu": "Dinner",
  "week": 1,
  "day": "Monday",
  "dishSlotId": "dinner:week1:Monday:Traditional",
  "dishSlot": "Traditional",
  "dishName": "Seared Hanger Steak with Bordelaise",
  "recipeKey": "Seared Hanger Steak with Bordelaise",
  "extractedRecipe": { "title": "...", "servings": "...", "ingredients": [], "steps": [], "sourceUrl": "..." }
}
```

Behavior:
- Validates admin secret.
- Updates exactly one recipe entry in `recipes.js` or `recipeslunch.js`.
- Validates updated JS contract (`window/globalThis.recipesData` or `recipesLunchData`) before commit.
- Commits via GitHub API using backend token.
- Returns commit SHA/URL.

Dry run:
- `POST /apply?dryRun=true` validates and returns `updatedFile` without committing.

Fallback patch response:
- If direct GitHub commit is unavailable, `/apply` returns `status: "patch_required"` with a `patch` payload for workflow dispatch.

### `POST /api/dispatchPatch`
Headers:
- `x-admin-secret: <ADMIN_SECRET>` (required if `ADMIN_SECRET` exists)

Request body (either shape):

```json
{
  "patch": { "...": "patch json" }
}
```

or direct patch object:

```json
{
  "menu": "dinner",
  "week": 2,
  "day": "Wednesday",
  "dishSlotId": "dinner:week2:Wednesday:Dessert",
  "dishSlotKey": "Dessert",
  "recipeData": { "...": "..." }
}
```

Behavior:
- Base64-encodes patch JSON.
- Dispatches GitHub Actions workflow (`workflow_dispatch`) with input `patch_b64`.
- Returns `{ ok: true, status: "Dispatched workflow", runUrl }` when dispatch accepted.

## Required environment variables

Set these as Cloudflare worker secrets/vars:

- `OPENAI_API_KEY` (secret)
- `GITHUB_TOKEN` (secret)
- `ADMIN_SECRET` (secret)
- `GITHUB_OWNER` (var)
- `GITHUB_REPO` (var)
- `GITHUB_BRANCH` (var, optional, default `main`)
- `GH_TOKEN` (secret, for Actions workflow dispatch)
- `GH_OWNER` (var)
- `GH_REPO` (var)
- `GH_WORKFLOW_FILE` (var, e.g. `apply-recipe-patch.yml`)
- `GH_REF` (var, branch/tag for dispatch, e.g. `main`)

Suggested GitHub token scope:
- Fine-grained PAT with repository `Contents: Read and write` on the target repo.
- For workflow dispatch via `/api/dispatchPatch`: token also needs `Actions: Read and write`.

## Deploy

From `backend/update-recipes-worker`:

```bash
npm i -g wrangler
wrangler secret put OPENAI_API_KEY
wrangler secret put GITHUB_TOKEN
wrangler secret put ADMIN_SECRET
wrangler secret put GH_TOKEN
wrangler deploy
```

Set vars in `wrangler.toml` or dashboard:
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`
- `GH_OWNER`
- `GH_REPO`
- `GH_WORKFLOW_FILE`
- `GH_REF`

After deploy, copy worker URL and paste it into the frontend "Backend API Base URL" field in the Update Recipes tab.
Enter `ADMIN_SECRET` in the Update tab's Admin Secret field before clicking Apply Update.
