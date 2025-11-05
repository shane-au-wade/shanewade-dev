# Recipe Database Schema

A simple PostgreSQL schema for storing recipe data extracted from OCR'd recipe
cards.

## Schema Overview

### Tables

#### `recipes`

Main table storing recipe metadata and OCR data.

- `id` - UUID (primary key)
- `title` - Recipe name
- `subtitle` - Optional subtitle/description
- `company_name` - Recipe source (e.g., "Marley Spoon")
- `servings` - Serving size info
- `cook_time` - Estimated cooking time
- `cooking_tips` - Additional tips and notes
- `ocr_markdown` - Full OCR text in markdown format
- `ocr_results` - JSONB with detailed OCR data
- `pages` - Array of source page names
- `created_at`, `updated_at` - Timestamps

#### `ingredients`

Recipe ingredients with quantities.

- `id` - Auto-incrementing primary key
- `recipe_id` - Foreign key to recipes
- `name` - Ingredient name
- `quantity` - Numeric quantity
- `unit` - Unit of measurement (oz, cups, etc.)
- `position` - Order in the ingredient list

#### `steps`

Cooking instructions.

- `id` - Auto-incrementing primary key
- `recipe_id` - Foreign key to recipes
- `title` - Step title/name
- `details` - Step instructions
- `position` - Order in the recipe

#### `mise_en_place_steps`

Preparation steps to do before cooking.

- Same structure as `steps`

#### `cooking_tools`

Required cooking equipment.

- `id` - Auto-incrementing primary key
- `recipe_id` - Foreign key to recipes
- `name` - Tool name
- `position` - Order in the list

## Running Migrations

Using Supabase CLI:

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push

# Or reset and apply all migrations
supabase db reset
```

## Usage Examples

### Inserting a Recipe

See `../scripts/insert-recipe.ts` for a complete example:

```typescript
import { createClient } from "@supabase/supabase-js"
import { insertRecipe } from "./scripts/insert-recipe.ts"

const supabase = createClient(url, key)
const recipe = await insertRecipe(supabase, recipeData)
```

### Querying Recipes

See `shared/recipes/queries` for examples:

```typescript
// Get all recipes
const recipes = await getAllRecipes(supabase)

// Get one recipe with all related data
const recipe = await getRecipe(supabase, recipeId)

// Search recipes
const results = await searchRecipes(supabase, "chicken")
```

## Design Decisions

1. **Simple & Normalized** - Each entity (ingredients, steps, etc.) has its own
   table for easy querying and updates
2. **Position Fields** - Maintain array order from original JSON
3. **JSONB for OCR** - Flexible storage for raw OCR data without rigid schema
4. **Cascade Deletes** - Removing a recipe automatically cleans up all related
   data
5. **Indexes** - Added on foreign keys and common query fields for performance

## Future Enhancements

If needed later, you could add:

- Full-text search on recipe titles and descriptions
- Tags/categories table with many-to-many relationship
- User ratings and comments
- Recipe images table (separate from OCR images)
- Nutritional information table
