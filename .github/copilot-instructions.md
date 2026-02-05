# Chef Dashboard - AI Coding Agent Instructions

## Project Overview
A client-side **Weekly Menu Ingredient Planner** for managing multi-week dining rotations with scalable recipes. This is a **static HTML/CSS/JavaScript application** with no backend—all data is hardcoded and loaded sequentially in memory.

## Architecture & Data Flow

### Core Data Structure
The app uses **4 separate JavaScript files** that load in strict sequence (critical for initialization):

1. **[data.js](data.js)** - Raw ingredient quantities organized by week/day/category:
   ```javascript
   const menuData = {
     menu: [
       {week: 1, day: "Monday", categories: {dairy: [...], protein: [...], dry: [...], other: [...], produce: [...]}},
       // ... weeks 1-2 fully populated
     ]
   }
   ```

2. **[menu_overview.js](menu_overview.js)** - Display names for each day's 9 categories (Appetizer 1/2, Elevated, Traditional, Alternative, Veg 1/2, Starch, Dessert):
   ```javascript
   const menuOverviewData = {
     "1": { "Monday": {"Appetizer 1": "Hot Appetizer: ...", "Elevated": "...", ...}, ...}
   }
   ```

3. **[recipes.js](recipes.js)** - Detailed recipe instructions with **3 scaling columns** (50/100/140 people):
   ```javascript
   const recipesData = {
     '1': {
       'Hot Appetizer: Crispy Prosciutto-Wrapped Mozzarella': '<h2>...</h2><table>...</table>'
     }
   }
   ```

4. **[data_add.js](data_add.js)** - **Placeholder skeletons for weeks 3-4** with empty category arrays to prevent UI errors when fetching undefined weeks.

5. **[recipes_add.js](recipes_add.js)** - Additional recipe HTML for weeks 3-4.

### Critical Pattern: Name Normalization
Recipes are **keyed by normalized dish names**. The `normalizeName()` function (`[script.js](script.js#L20)`) must match menu entries to recipe keys:
- Removes parenthetical notes: `"Charred Green Beans (optional)" → "charred green beans"`
- Replaces hyphens/commas with spaces
- Converts HTML entities: `&amp; → and`
- Removes filler words: `with, and`
- Returns lowercase for comparison

**When adding recipes**: The recipe key in `recipesData` must normalize to match the menu dish name in `menuOverviewData`.

### Two Distinct View Modes
- **Recipe Search** (default active tab): Shows menu categories → dish click → displays recipe HTML
- **Ingredients Checker** (tab 2): Shows all ingredients for selected week/day grouped by category with totals

UI logic is separate per mode; filtering affects both independently.

## Developer Workflows

### Adding Recipes for Week 3-4
1. **[recipes_add.js](recipes_add.js)**: Append new recipe objects with normalized keys:
   ```javascript
   recipesData['3']['Seared Halibut with Lemon Beurre Blanc'] = '<h2>...</h2>...'
   ```
2. **[data_add.js](data_add.js)**: Populate ingredient arrays in the placeholder structure:
   ```javascript
   {week: 3, day: 'Monday', categories: {
     dairy: [{name: "Butter", quantity: 2, unit: "lb"}, ...],
     ...
   }}
   ```

### Updating Menu Dishes Week 1-2
Edit [menu_overview.js](menu_overview.js) directly—add new dish names or modify existing entries. The category order (Appetizer 1, Appetizer 2, Elevated, Traditional, Alternative, Veg 1, Veg 2, Starch, Dessert) is **hardcoded in [script.js](script.js#L5)** as `categoryTitles`.

### Extending to New Weeks
Create new files (`data_week5.js`, `recipes_week5.js`), load in [index.html](index.html), and append to placeholder skeletons in `data_add.js`.

## Project-Specific Conventions

### Recipe Format
All recipes in `recipesData` use **HTML table format** with these columns:
- Ingredient name
- Qty for 50 people
- Qty for 100 people  
- Qty for 140 people

Recipes end with a **Holding/Service section** (temperature cap, timing notes).

### Ingredient Categories
Always use this set: `dairy`, `protein`, `dry`, `other`, `produce` (order may vary per day).

### Safe Data Access
Files use defensive checks to allow incremental loading:
```javascript
if (typeof recipesData === 'undefined') { var recipesData = {}; }
recipesData['3'] = { ... };  // Safely extend at module level
```

### Event Handling Pattern
Dish selection uses **`itemBlock.dataset.dish`** to store the normalized name, then `handleDishClick()` looks up the recipe in `recipesData[week]`.

## Integration Points

### UI Rendering ([script.js](script.js))
- `renderMenuRow()` - Creates `.menu-item-block` divs for each category, attaches click listeners
- `renderRecipe()` - Displays recipe HTML from `recipesData`
- `renderIngredients()` - Groups ingredients by category, applies search filtering
- `handleDishClick(itemBlock)` - Toggles active state, triggers recipe/ingredient display

### Data Validation
- Always check `typeof menuOverviewData[week]?.[day]` before accessing
- Fall back to `"Add alternative"` placeholder if dish is null/undefined
- Log console warnings if recipe key doesn't exist (normalization mismatch)

## Common Pitfalls
1. **Normalization mismatch**: Menu name "Coffee-Rubbed Beef & Tenderloin" must normalize to recipe key exactly
2. **Missing week scaffolding**: Weeks 3-4 will cause errors without empty category arrays in `data_add.js`
3. **Load order**: JS files must load in [index.html](index.html) order (data, menu_overview, recipes, then data_add/recipes_add, finally script.js)
4. **Category typos**: Recipe category names must match the set above; UI won't display if spelled differently
5. **Scaling math**: Ingredient quantities in data.js should match the 50/100/140 ratios in recipes.js for consistency

## File References
- Main logic: [script.js](script.js) (320 lines)
- Styling: [style.css](style.css)
- Data sources: [data.js](data.js), [menu_overview.js](menu_overview.js), [recipes.js](recipes.js), [data_add.js](data_add.js), [recipes_add.js](recipes_add.js)
- Markup: [index.html](index.html)
