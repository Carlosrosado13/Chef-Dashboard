# Chef Dashboard

## Update Recipes Admin Workflow

This project now includes an **Update Recipes** admin tab in the static frontend.

### Frontend usage

1. Open the site.
2. Go to **Update Recipes** tab.
3. Fill:
   - Backend API Base URL (your deployed worker URL)
   - Admin Secret
   - Menu / Week / Day / Dish Slot
   - Recipe URL
4. Click **Extract & Preview**.
5. Review preview:
   - Title
   - Ingredients
   - Steps
   - Generated site-format HTML
6. Click **Apply Update** to commit the update to GitHub.

### Security model

- No OpenAI or GitHub token is stored in frontend code.
- Backend worker reads:
  - `OPENAI_API_KEY`
  - `GITHUB_TOKEN`
  - `ADMIN_SECRET`
- `/apply` requires `x-admin-secret`.

### Backend deployment

Worker code and deploy instructions:

- `backend/update-recipes-worker/src/index.mjs`
- `backend/update-recipes-worker/wrangler.toml`
- `backend/update-recipes-worker/README.md`

### Existing extraction workflow

To regenerate ingredient/grocery exports and reports:

```bash
node er/extractIngredients.js
```
