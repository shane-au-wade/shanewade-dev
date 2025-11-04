# Ingredient Schema Enhancement Migration Guide

## Overview

This migration improves the ingredient extraction and grocery list generation by normalizing data at the **extraction time** rather than query time.

## Changes Made

### 1. **Updated Extraction Schema** (`scripts/eval/extract.ts`)

**New Fields:**

- `is_pantry_staple: boolean` - Marks common pantry items (salt, pepper, oil, water)
- `preparation_note: string | null` - Stores prep instructions like "diced", "minced", "peeled"

**Normalized Units:**

- Enforced enum of allowed units (no more `"oz."` vs `"oz"`)
- Standardized: `oz`, `lb`, `cup`, `tbsp`, `tsp`, `fl oz`, `whole`, etc.
- LLM now normalizes units during extraction

**Improved Prompts:**

- Clear instructions for Title Case ingredient names
- Removal of parenthetical customization text
- Unit normalization rules
- Pantry staple identification

### 2. **Database Migration** (`supabase/migrations/20251101000000_enhance-ingredients.sql`)

**Added Columns:**

```sql
ALTER TABLE ingredients 
  ADD COLUMN is_pantry_staple BOOLEAN DEFAULT false,
  ADD COLUMN preparation_note TEXT;
```

**Added Constraint:**

```sql
ALTER TABLE ingredients
  ADD CONSTRAINT unit_normalized CHECK (
    unit IS NULL OR 
    unit IN ('oz', 'lb', 'g', 'kg', 'cup', 'tbsp', 'tsp', 'ml', 'l', 
             'whole', 'slice', 'clove', 'pinch', 'dash', 'fl oz')
  );
```

### 3. **Updated Grocery List Function** (`web/src/lib/recipes.ts`)

- Now uses `is_pantry_staple` field from database
- Falls back to legacy hardcoded list for old data
- Better type safety with explicit casts
- Same normalization logic but cleaner code path

## Migration Steps

### Step 1: Apply Database Migration

```bash
# Navigate to project root
cd /Users/shane/repos/shanewade-dev

# Apply the migration (if using Supabase CLI)
supabase db push

# OR manually run the SQL file
psql <your-connection-string> -f supabase/migrations/20251101000000_enhance-ingredients.sql
```

### Step 2: Re-extract All Recipes

```bash
# Run the extraction script with updated schema
deno run --allow-all scripts/eval/extract.ts
```

This will:

- Extract ingredients with new normalized units
- Mark pantry staples automatically
- Extract preparation notes
- Validate units against the enum

### Step 3: Reload Data to Database

```bash
# Use your insert script to reload the newly extracted data
deno run --allow-all scripts/insert-recipe.ts
```

### Step 4: Verify

```typescript
// Test the grocery list function
import { testGetGroceryListFromRecipes } from "./web/src/lib/recipes.ts"

await testGetGroceryListFromRecipes(supabase)
```

Expected improvements:

- ✅ "Salt", "Pepper", "Cooking Oil" → "as needed" (no quantity)
- ✅ No more "oz." vs "oz" duplicates
- ✅ Cleaner ingredient names (no parenthetical junk)
- ✅ Preparation notes separated from ingredient names

## Benefits

### Before:

```json
{
  "display_name": "Ground Pork (or Ground Beef, or Smoky-Flavored Poblano Pork Sausage, or Shrimp)",
  "quantity": 10,
  "unit": "oz."
}
```

### After:

```json
{
  "display_name": "Ground Pork",
  "quantity": 10,
  "unit": "oz",
  "is_pantry_staple": false,
  "preparation_note": null
}
```

### Impact on Grocery List:

- **Before:** 180+ lines of normalization logic
- **After:** ~50 lines, most work done at extraction
- **Future:** Can add ingredient catalog table for even more consolidation

## Rollback Plan

If issues arise:

1. Keep old data backup
2. Migration is non-destructive (only adds columns)
3. Code handles both old and new data via fallbacks
4. Can revert schema changes with:

```sql
ALTER TABLE ingredients 
  DROP COLUMN is_pantry_staple,
  DROP COLUMN preparation_note,
  DROP CONSTRAINT unit_normalized;
```

## Next Steps (Optional Future Work)

1. **Create Ingredients Catalog Table**
   - Canonical ingredient names
   - Category classification (produce, dairy, protein, etc.)
   - Standard container sizes
   - Aliases for matching

2. **Smart Grouping in Grocery Lists**
   - Group by store section (Produce, Dairy, Meat, etc.)
   - Sort by aisle for efficient shopping

3. **Nutrition Data Integration**
   - Link to USDA nutrition database
   - Automatic nutrition calculations

4. **Price Estimation**
   - Average prices per ingredient
   - Total grocery bill estimation
