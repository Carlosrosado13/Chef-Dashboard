# Chef Dashboard

## Update Recipes Admin Workflow

This project includes an **Update Recipes** admin tab with a local patch workflow.

### Frontend usage

1. Open the site.
2. Go to **Update Recipes** tab.
3. Fill:
   - Extract API Base URL (for `/extract`)
   - Menu / Week / Day / Dish Slot
   - Recipe URL
4. Click **Extract & Preview**.
5. Review preview:
   - Title
   - Ingredients
   - Steps
   - Generated site-format HTML
6. Click **Download Patch JSON**.
7. Apply locally:

```bash
node er/applyRecipePatch.js path/to/patch.json
```

8. Then:
   - `git add .`
   - `git commit -m "Update recipe"`
   - `git push`
9. Hard refresh the website.

### Notes

- `Apply Update` can run in two modes:
  - Local mode (no admin secret): updates local storage only.
  - Backend mode (admin secret): uses Worker `/apply`, and can auto-queue `/api/dispatchPatch`.
- Patch JSON contains stable identifiers: `menu`, `week`, `day`, `dishSlotId`, `dishSlotKey`, and `recipeData`.
- `er/applyRecipePatch.js` updates the correct recipe file and menu slot entry.

### Backend deployment

Worker code and deploy instructions:

- `backend/update-recipes-worker/src/index.mjs`
- `backend/update-recipes-worker/wrangler.toml`
- `backend/update-recipes-worker/README.md`

Use backend for extraction endpoint (`/extract`) only in this workflow.

### Automatic Apply Setup (Worker + GitHub Actions)

To enable automatic patch apply (`Apply Update` queues GitHub Actions):

1. Add workflow file: `.github/workflows/apply-recipe-patch.yml`
2. Configure Worker secrets/vars:
   - `GH_TOKEN` (Fine-grained PAT)
   - `GH_OWNER` (e.g. `your-org`)
   - `GH_REPO` (e.g. `chef-dashboard`)
   - `GH_WORKFLOW_FILE=apply-recipe-patch.yml`
   - `GH_REF=main`
3. Token permissions required on `GH_TOKEN`:
   - Repository `Contents: Read and write`
   - Repository `Actions: Read and write`
4. Frontend flow:
   - UI calls `/apply`
   - If patch workflow is needed, UI auto-calls `/api/dispatchPatch`
   - UI shows queued status and workflow run link (when returned)

### Existing extraction workflow

To regenerate ingredient/grocery exports and reports:

```bash
node er/extractIngredients.js
```
