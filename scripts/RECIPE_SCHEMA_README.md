# Recipe Data Schema Documentation

## Overview

This schema is designed to extract, store, and manage recipe data from multiple
meal kit providers (Green Chef, Hello Fresh, Home Chef, etc.) to support:

1. **Semantic Search** - Find recipes by meaning, not just keywords
2. **Meal Planning** - Curate weekly meal plans
3. **Shopping List Generation** - Automatically generate ingredient lists
4. **Recipe Management** - Track favorites, ratings, and cooking history

## Architecture

### Data Storage Strategy

The system uses a **hybrid storage approach**:

#### ChromaDB (Vector Database)

**Purpose:** Semantic search, similarity matching, and natural language queries

**What to Store:**

- **Documents (embedded text):**
  - Recipe title + subtitle
  - Full description
  - Formatted ingredient list
  - Cooking instructions

- **Metadata (for filtering):**
  - `provider`: Recipe source
  - `mealTypes`: Array of meal types
  - `dietaryTags`: Dietary restrictions/preferences
  - `cuisineType`: Cuisine category
  - `mainProtein`: Primary protein
  - `cookTimeMinutes`: Cooking duration
  - `difficultyLevel`: Recipe difficulty
  - `caloriesPerServing`: Nutritional info
  - `allergens`: Allergen list
  - `searchKeywords`: Searchable terms

**Example Queries Enabled:**

```javascript
// Semantic similarity
"Find recipes similar to chicken tacos with a creamy sauce"

// Filtered search
"Quick vegetarian dinners under 30 minutes with high protein"

// Natural language
"What can I make with pork that's spicy and Asian-inspired?"
```

#### PostgreSQL (Relational Database)

**Purpose:** Structured data storage, relationships, and transactional
operations

**Table Structure:**

```sql
-- Core recipe data
CREATE TABLE recipes (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  provider VARCHAR(50),
  description TEXT,
  cook_time_minutes INTEGER,
  difficulty_level VARCHAR(20),
  raw_data JSONB,  -- Full recipe object
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Normalized ingredients (master list)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT UNIQUE NOT NULL,
  category VARCHAR(50),
  common_unit VARCHAR(20)
);

-- Recipe-ingredient relationships
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id),
  ingredient_id UUID REFERENCES ingredients(id),
  quantity DECIMAL,
  unit VARCHAR(20),
  servings INTEGER,
  preparation TEXT,
  optional BOOLEAN DEFAULT FALSE
);

-- Meal planning
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY,
  name TEXT,
  start_date DATE,
  end_date DATE,
  user_id UUID,
  created_at TIMESTAMP
);

CREATE TABLE planned_meals (
  id UUID PRIMARY KEY,
  meal_plan_id UUID REFERENCES meal_plans(id),
  recipe_id UUID REFERENCES recipes(id),
  scheduled_date TIMESTAMP,
  meal_type VARCHAR(20),
  servings INTEGER,
  completed BOOLEAN DEFAULT FALSE
);

-- Shopping lists
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY,
  meal_plan_id UUID REFERENCES meal_plans(id),
  name TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP
);

CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY,
  shopping_list_id UUID REFERENCES shopping_lists(id),
  ingredient_id UUID REFERENCES ingredients(id),
  total_quantity DECIMAL,
  unit VARCHAR(20),
  checked BOOLEAN DEFAULT FALSE,
  estimated_cost DECIMAL
);

-- User data
CREATE TABLE user_recipe_data (
  user_id UUID,
  recipe_id UUID REFERENCES recipes(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  times_cooked INTEGER DEFAULT 0,
  last_cooked_date TIMESTAMP,
  is_favorite BOOLEAN DEFAULT FALSE,
  notes TEXT,
  PRIMARY KEY (user_id, recipe_id)
);
```

---

## Schema Design Details

### 1. Recipe Structure

The `Recipe` type is the core data structure containing:

#### Identity & Metadata

- Unique ID, title, provider
- OCR source references
- Timestamps

#### Classification

- Meal types (breakfast, lunch, dinner, etc.)
- Dietary tags (vegetarian, vegan, keto, etc.)
- Cuisine type
- Main protein

#### Cooking Details

- Time estimates (cook, prep, active)
- Difficulty and spice levels
- Serving options

#### Content

- Ingredients (structured list)
- Steps (ordered instructions)
- Equipment needed
- Allergen information

#### User Data

- Ratings and notes
- Cooking history
- Favorites

### 2. Ingredient Structure

The `Ingredient` type supports:

```typescript
{
  name: string              // "Kale"
  normalizedName: string    // "kale" (for matching)
  rawQuantity: string       // "3 1/2" (as appears in recipe)
  quantity: number          // 3.5 (parsed decimal)
  unit: IngredientUnit      // "oz"
  servings: number          // 2 (quantity is for this many servings)
  preparation?: string      // "diced", "chopped"
  category?: string         // "PRODUCE"
  optional: boolean         // false
}
```

**Key Features:**

- **Quantity Parsing:** Handles fractions, ranges, and mixed numbers
- **Normalization:** Enables matching across recipes
- **Scaling:** Quantities tied to serving sizes
- **Categorization:** Groups for shopping list organization

### 3. Recipe Steps

The `RecipeStep` type provides:

```typescript
{
  stepNumber: number
  title?: string              // "PREP", "COOK PORK"
  instruction: string         // Full instructions
  estimatedTime?: number      // Minutes for this step
  temperature?: number        // Cooking temp
  equipment?: string[]        // Tools needed
  visualCues?: string[]       // "until golden brown"
  tips?: string[]            // Pro tips
}
```

**Benefits:**

- Clear step-by-step structure
- Time estimation per step
- Equipment planning
- Learning aids (tips & visual cues)

---

## Parsing Strategy

### From OCR to Structured Data

The OCR output is JSONL format, each line containing:

```json
{
  "id": "batch-id",
  "custom_id": "recipe-id",
  "response": {
    "body": {
      "pages": [{
        "markdown": "# Recipe Title\n\n...",
        "images": [...]
      }]
    }
  }
}
```

### Parsing Steps

1. **Extract Markdown:** Get OCR text from JSON
2. **Identify Provider:** Parse from headers (GREEN CHEF, etc.)
3. **Parse Metadata:** Cook time, calories, difficulty
4. **Extract Title & Description:** From markdown headings
5. **Parse Ingredients Table:** Convert markdown table to structured list
6. **Parse Instructions:** Extract step-by-step from sections
7. **Extract Equipment:** From "WHAT YOU'LL NEED" sections
8. **Identify Allergens:** Scan for common allergens
9. **Extract Images:** Get image references and coordinates
10. **Generate Keywords:** Auto-create search terms

### Handling Provider Variations

Different providers have different formats:

**Green Chef:**

- Clear ingredient tables with 2/4 serving columns
- Step-by-step with headings (## PREP, ## COOK)
- Detailed allergen markers

**Hello Fresh:**

- Similar structure to Green Chef
- "HelloCustom" sections for modifications
- "BUST OUT" equipment lists

**Home Chef:**

- Difficulty levels (EASY, INTERMEDIATE)
- "Cook Within X Days" freshness info
- Minimum internal temperature guides

**EveryPlate:**

- Simpler format
- "CustomPlate" modifications
- More casual tone

**The Parser Handles:**

- Different heading styles
- Various ingredient table formats
- Multiple instruction layouts
- Provider-specific terminology

---

## Use Cases

### 1. Semantic Recipe Search

```typescript
// ChromaDB query
const results = await chromaCollection.query({
  queryTexts: ["spicy chicken dinner with Asian flavors"],
  nResults: 10,
  where: {
    cookTimeMinutes: { $lt: 45 },
    dietaryTags: { $contains: "GLUTEN_FREE" },
  },
})
```

### 2. Meal Planning Algorithm

```typescript
// Example: Plan a week of dinners
async function createWeeklyMealPlan(preferences: {
  servings: number
  dietaryRestrictions: string[]
  maxCookTime: number
  variety: boolean // avoid same protein 2 days in a row
}) {
  const meals: PlannedMeal[] = []
  const usedProteins: string[] = []

  for (let day = 0; day < 7; day++) {
    // Query ChromaDB for suitable recipes
    const candidates = await searchRecipes({
      cookTimeMinutes: { $lt: preferences.maxCookTime },
      dietaryTags: { $contains: preferences.dietaryRestrictions },
      mainProtein: { $nin: preferences.variety ? usedProteins : [] },
    })

    // Select recipe (could use AI/ML for better selection)
    const selected = candidates[0]

    meals.push({
      id: crypto.randomUUID(),
      recipeId: selected.id,
      scheduledDate: addDays(new Date(), day),
      mealType: "DINNER",
      servings: preferences.servings,
      completed: false,
    })

    if (preferences.variety) {
      usedProteins.push(selected.mainProtein)
      if (usedProteins.length > 2) usedProteins.shift()
    }
  }

  return meals
}
```

### 3. Shopping List Generation

```typescript
async function generateShoppingList(
  mealPlanId: string,
): Promise<ShoppingList> {
  // Get all meals in the plan
  const meals = await db.plannedMeals
    .where({ meal_plan_id: mealPlanId })
    .with("recipe.ingredients")

  // Aggregate ingredients
  const aggregated = new Map<string, {
    ingredient: Ingredient
    totalQuantity: number
    recipes: string[]
  }>()

  for (const meal of meals) {
    for (const ingredient of meal.recipe.ingredients) {
      // Scale quantity for servings
      const scaleFactor = meal.servings / ingredient.servings
      const scaledQty = ingredient.quantity * scaleFactor

      // Aggregate by normalized name
      const key = ingredient.normalizedName

      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!
        // Convert to same unit if needed (TODO: unit conversion)
        existing.totalQuantity += scaledQty
        existing.recipes.push(meal.recipeId)
      } else {
        aggregated.set(key, {
          ingredient,
          totalQuantity: scaledQty,
          recipes: [meal.recipeId],
        })
      }
    }
  }

  // Create shopping list items
  const items: ShoppingListItem[] = Array.from(aggregated.values())
    .map(({ ingredient, totalQuantity, recipes }) => ({
      id: crypto.randomUUID(),
      ingredientName: ingredient.normalizedName,
      displayName: ingredient.name,
      totalQuantity: roundQuantity(totalQuantity),
      unit: ingredient.unit,
      category: ingredient.category || "OTHER",
      recipeIds: recipes,
      checked: false,
      notes: undefined,
    }))
    .sort((a, b) => {
      // Sort by category for easier shopping
      const categoryOrder = [
        "PRODUCE",
        "PROTEIN",
        "DAIRY",
        "GRAINS",
        "PANTRY",
        "SPICES",
      ]
      return categoryOrder.indexOf(a.category) -
        categoryOrder.indexOf(b.category)
    })

  return {
    id: crypto.randomUUID(),
    mealPlanId,
    name: `Shopping List - ${new Date().toLocaleDateString()}`,
    items,
    createdAt: new Date(),
    updatedAt: new Date(),
    completed: false,
  }
}

function roundQuantity(qty: number): number {
  // Round to sensible fractions (0.25, 0.5, 0.75)
  return Math.round(qty * 4) / 4
}
```

### 4. AI Meal Curation Agent

```typescript
// Using LLM to intelligently curate meals
async function curateIntelligentMealPlan(params: {
  duration: number // days
  preferences: string // natural language
  budget?: number
}) {
  // Step 1: Use LLM to parse preferences
  const parsed = await llm.parse(params.preferences)

  // Step 2: Query ChromaDB with semantic search
  const recipePool = await chromaCollection.query({
    queryTexts: [params.preferences],
    nResults: 50,
    where: buildFilterFromParsed(parsed),
  })

  // Step 3: Use LLM to select and sequence meals
  const prompt = `
    Given these recipes: ${JSON.stringify(recipePool)}
    And these preferences: ${params.preferences}
    
    Create a ${params.duration}-day meal plan that:
    - Provides variety in proteins and cuisines
    - Balances cooking times (some quick, some longer)
    - Minimizes ingredient waste (reuse ingredients)
    - Meets dietary preferences
    - Stays within budget: $${params.budget}
    
    Return a JSON array of recipe IDs in order.
  `

  const selection = await llm.generate(prompt)

  // Step 4: Generate shopping list
  const shoppingList = await generateShoppingList(selection)

  return { mealPlan: selection, shoppingList }
}
```

---

## Advanced Features

### Ingredient Intelligence

**Unit Conversion:**

```typescript
const conversions = {
  "oz": { to: "lb", factor: 0.0625 },
  "tsp": { to: "tbsp", factor: 0.333 },
  "tbsp": { to: "cup", factor: 0.0625 },
}
```

**Ingredient Substitutions:**

```typescript
const substitutions = {
  "sour cream": ["greek yogurt", "creme fraiche"],
  "buttermilk": ["milk + vinegar", "yogurt"],
  "heavy cream": ["half and half", "milk + butter"],
}
```

### Recipe Scaling

```typescript
function scaleRecipe(recipe: Recipe, newServings: number): Recipe {
  const scaleFactor = newServings / recipe.defaultServings

  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: ing.quantity * scaleFactor,
      servings: newServings,
    })),
    steps: recipe.steps, // steps stay the same, just note serving change
  }
}
```

### Waste Minimization

Track ingredient usage across meals:

```typescript
function findRecipesUsingIngredient(
  ingredient: string,
  recipes: Recipe[],
): Recipe[] {
  return recipes.filter((r) => r.ingredients.some((ing) => ing.normalizedName.includes(ingredient)))
}
```

---

## Next Steps

### 1. Immediate: Parse All OCR Data

```bash
deno run --allow-read --allow-write recipe-parser-example.ts
```

### 2. Setup ChromaDB

```typescript
import { ChromaClient } from "chromadb"

const client = new ChromaClient()
const collection = await client.createCollection({
  name: "recipes",
  metadata: { "hnsw:space": "cosine" },
})

// Add recipes
for (const recipe of recipes) {
  await collection.add({
    ids: [recipe.id],
    documents: [formatForEmbedding(recipe)],
    metadatas: [extractMetadata(recipe)],
  })
}
```

### 3. Setup PostgreSQL

```bash
# Install schema
psql -U postgres -d recipes -f schema.sql

# Insert recipes
# Use your preferred ORM (Prisma, Drizzle, etc.)
```

### 4. Build Meal Planning Agent

- Implement meal curation algorithm
- Add user preference learning
- Build shopping list optimization
- Create web interface

### 5. Enhancements

- [ ] Add recipe ratings and reviews
- [ ] Implement cooking mode (step-by-step with timers)
- [ ] Add photo upload for completed meals
- [ ] Nutritional tracking and analysis
- [ ] Recipe recommendations based on history
- [ ] Grocery price tracking
- [ ] Leftover management
- [ ] Recipe scaling calculator
- [ ] Substitution suggestions
- [ ] Meal prep batching

---

## Files in This Schema Package

1. **`recipe-schema.ts`** - Complete TypeScript type definitions
2. **`recipe-parser-example.ts`** - OCR-to-schema parser with examples
3. **`RECIPE_SCHEMA_README.md`** - This documentation

## Questions?

This schema is designed to be flexible and extensible. Feel free to:

- Add new fields as needed
- Extend types with provider-specific data
- Add custom user fields
- Implement additional features

The key principles:

1. **Normalized data** for matching and aggregation
2. **Rich metadata** for search and filtering
3. **Flexible structure** to handle provider variations
4. **User-centric** features for practical use
