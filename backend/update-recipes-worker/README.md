# Update Recipes Worker (Cloudflare)

This worker provides two admin endpoints for the static Chef Dashboard frontend:

- `POST /extract`
- `POST /apply`

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
  "menu": "dinner",
  "week": 1,
  "day": "Monday",
  "dishId": "dinner:week1:Monday:Traditional",
  "dishSlot": "Traditional",
  "dishName": "Seared Hanger Steak with Bordelaise",
  "recipeKey": "Seared Hanger Steak with Bordelaise",
  "recipeJson": { "title": "...", "servings": "...", "ingredients": [], "steps": [], "sourceUrl": "..." }
}
```

Behavior:
- Validates admin secret.
- Updates exactly one recipe entry in `recipes.js` or `recipeslunch.js`.
- Commits via GitHub API using backend token.
- Returns commit SHA/URL.

## Required environment variables

Set these as Cloudflare worker secrets/vars:

- `OPENAI_API_KEY` (secret)
- `GITHUB_TOKEN` (secret)
- `ADMIN_SECRET` (secret)
- `GITHUB_OWNER` (var)
- `GITHUB_REPO` (var)
- `GITHUB_BRANCH` (var, optional, default `main`)

## Deploy

From `backend/update-recipes-worker`:

```bash
npm i -g wrangler
wrangler secret put OPENAI_API_KEY
wrangler secret put GITHUB_TOKEN
wrangler secret put ADMIN_SECRET
wrangler deploy
```

Set vars in `wrangler.toml` or dashboard:
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`

After deploy, copy worker URL and paste it into the frontend "Backend API Base URL" field in the Update Recipes tab.
