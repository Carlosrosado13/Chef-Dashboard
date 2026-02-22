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

- `Apply Update` in the UI is now a local workflow helper (no backend commit).
- Patch JSON contains stable identifiers: `menu`, `week`, `day`, `dishSlotId`, `dishSlotKey`, and `recipeData`.
- `er/applyRecipePatch.js` updates the correct recipe file and menu slot entry.

### Backend deployment

Worker code and deploy instructions:

- `backend/update-recipes-worker/src/index.mjs`
- `backend/update-recipes-worker/wrangler.toml`
- `backend/update-recipes-worker/README.md`

Use backend for extraction endpoint (`/extract`) only in this workflow.

### Existing extraction workflow

To regenerate ingredient/grocery exports and reports:

```bash
node er/extractIngredients.js
```
