# Recipe Schema - Getting Started Guide

## Overview

You've successfully OCR'd your recipe cards! This guide will help you extract
structured data and build your meal planning system.

## 📁 Files Created

### Schema & Types

- **`recipe-schema.ts`** - Complete TypeScript type definitions for recipes,
  ingredients, steps, meal plans, and shopping lists

### Parser

- **`recipe-parser-example.ts`** - Parser that converts OCR JSONL data into
  structured recipe objects

### Database Setup

- **`recipe-schema.sql`** - PostgreSQL database schema with tables, indexes,
  views, and functions

### ChromaDB Integration

- **`chromadb-integration-example.ts`** - Examples for semantic search and
  vector database integration

### Documentation

- **`RECIPE_SCHEMA_README.md`** - Comprehensive documentation of the schema
  design
- **`GETTING_STARTED.md`** - This file!

## 🚀 Quick Start

### Step 1: Parse Your OCR Data

Run the parser on your JSONL file:

```bash
deno run --allow-read --allow-write recipe-parser-example.ts
```

This will:

- Parse all recipes from `batch-ocr-results-recipes-1-to-25.jsonl`
- Extract structured data (ingredients, steps, metadata)
- Output parsed recipes with confidence scores
- Show any parsing warnings

**Expected Output:**

```
Parsed 25 recipes

First recipe:
{
  "id": "79458545-ff37-4644-902f-1db8d514cebb-doxie-0303",
  "title": "GYRO-SPICED PORK FILET KALE SALAD",
  "provider": "GREEN_CHEF",
  "cookTimeMinutes": 30,
  "ingredients": [...],
  "steps": [...],
  ...
}

Confidence scores:
Recipe 1: GYRO-SPICED PORK FILET KALE SALAD - 95.0%
Recipe 2: SPICED PORK TACOS WITH PINEAPPLE SALSA - 90.0%
...
```

### Step 2: Set Up PostgreSQL

1. **Create a database:**

```bash
createdb recipes
```

2. **Run the schema:**

```bash
psql -U postgres -d recipes -f recipe-schema.sql
```

3. **Verify tables:**

```bash
psql -U postgres -d recipes -c "\dt"
```

You should see:

- `recipes`
- `ingredients`
- `recipe_ingredients`
- `recipe_steps`
- `recipe_images`
- `meal_plans`
- `planned_meals`
- `shopping_lists`
- `shopping_list_items`
- `user_recipe_data`

### Step 3: Load Recipes into PostgreSQL

Create a simple loader script:

```typescript
// load-recipes.ts
import { parseRecipeJSONL } from "./recipe-parser-example.ts"
import postgres from "postgres"

const sql = postgres("postgresql://localhost/recipes")

async function loadRecipes() {
  // Parse recipes
  const results = await parseRecipeJSONL(
    "./batch-ocr-results-recipes-1-to-25.jsonl",
  )

  console.log(`Parsed ${results.length} recipes`)

  // Insert into PostgreSQL
  for (const { recipe, confidenceScore, warnings } of results) {
    // Insert recipe
    const [recipeRow] = await sql`
      INSERT INTO recipes (
        id, title, provider, description,
        cook_time_minutes, difficulty_level,
        default_servings, allergens, raw_data
      ) VALUES (
        ${recipe.id}, ${recipe.title}, ${recipe.provider},
        ${recipe.description}, ${recipe.cookTimeMinutes},
        ${recipe.difficultyLevel}, ${recipe.defaultServings},
        ${recipe.allergens}, ${JSON.stringify(recipe)}
      )
      RETURNING id
    `

    console.log(`✓ Loaded: ${recipe.title} (${confidenceScore * 100}%)`)

    // Insert ingredients
    for (const ingredient of recipe.ingredients) {
      // First, upsert the ingredient
      const [ing] = await sql`
        INSERT INTO ingredients (name, normalized_name, category)
        VALUES (${ingredient.name}, ${ingredient.normalizedName}, ${ingredient.category})
        ON CONFLICT (normalized_name) DO UPDATE
        SET name = EXCLUDED.name
        RETURNING id
      `

      // Then link to recipe
      await sql`
        INSERT INTO recipe_ingredients (
          recipe_id, ingredient_id, raw_quantity,
          quantity, unit, servings
        ) VALUES (
          ${recipe.id}, ${ing.id}, ${ingredient.rawQuantity},
          ${ingredient.quantity}, ${ingredient.unit}, ${ingredient.servings}
        )
      `
    }

    // Insert steps
    for (const step of recipe.steps) {
      await sql`
        INSERT INTO recipe_steps (
          recipe_id, step_number, title, instruction,
          estimated_time_minutes, temperature, temperature_unit
        ) VALUES (
          ${recipe.id}, ${step.stepNumber}, ${step.title},
          ${step.instruction}, ${step.estimatedTime},
          ${step.temperature}, ${step.temperatureUnit}
        )
      `
    }
  }

  console.log("\n✅ All recipes loaded into PostgreSQL!")

  // Show stats
  const [stats] = await sql`
    SELECT
      COUNT(*) as recipe_count,
      COUNT(DISTINCT ri.ingredient_id) as unique_ingredients
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
  `

  console.log(`\nDatabase Stats:`)
  console.log(`  Recipes: ${stats.recipe_count}`)
  console.log(`  Unique Ingredients: ${stats.unique_ingredients}`)

  await sql.end()
}

loadRecipes()
```

Run it:

```bash
deno run --allow-read --allow-net load-recipes.ts
```

### Step 4: Set Up ChromaDB

1. **Install ChromaDB:**

```bash
npm install chromadb
# or
yarn add chromadb
```

2. **Start ChromaDB server:**

```bash
# Option A: Using Docker
docker run -p 8000:8000 chromadb/chroma

# Option B: Using Python
pip install chromadb
chroma run --path ./chroma-data
```

3. **Load recipes into ChromaDB:**

```typescript
// load-chroma.ts
import { ChromaClient } from "chromadb"
import { parseRecipeJSONL } from "./recipe-parser-example.ts"
import { addRecipesToChroma, setupRecipeCollection } from "./chromadb-integration-example.ts"

async function loadChromaDB() {
  const client = new ChromaClient({ path: "http://localhost:8000" })
  const collection = await setupRecipeCollection(client)

  // Parse recipes
  const results = await parseRecipeJSONL(
    "./batch-ocr-results-recipes-1-to-25.jsonl",
  )
  const recipes = results.map((r) => r.recipe)

  // Add to ChromaDB
  await addRecipesToChroma(collection, recipes)

  console.log(`✅ Loaded ${recipes.length} recipes into ChromaDB!`)

  // Test a search
  const searchResults = await collection.query({
    queryTexts: ["spicy chicken dinner"],
    nResults: 3,
  })

  console.log('\nTest Search Results for "spicy chicken dinner":')
  searchResults.documents[0].forEach((doc, i) => {
    console.log(`${i + 1}. ${doc.substring(0, 100)}...`)
  })
}

loadChromaDB()
```

Run it:

```bash
deno run --allow-net --allow-read load-chroma.ts
```

## 🎯 Next Steps: Build Your Meal Planning System

### Phase 1: Basic Queries ✅

Test your setup with some basic queries:

```typescript
// query-recipes.ts
import { ChromaClient } from "chromadb"
import postgres from "postgres"

const client = new ChromaClient({ path: "http://localhost:8000" })
const collection = await client.getCollection({ name: "recipes" })
const sql = postgres("postgresql://localhost/recipes")

// Semantic search in ChromaDB
const results = await collection.query({
  queryTexts: ["quick weeknight dinner"],
  nResults: 5,
  where: { cookTimeMinutes: { $lt: 30 } },
})

console.log("Quick Dinners:")
for (const id of results.ids[0]) {
  const [recipe] = await sql`
    SELECT title, cook_time_minutes, difficulty_level
    FROM recipes
    WHERE id = ${id}
  `
  console.log(`- ${recipe.title} (${recipe.cook_time_minutes} min)`)
}
```

### Phase 2: Simple Meal Planner

Create a basic meal planning function:

```typescript
// meal-planner.ts
async function createWeeklyMealPlan(preferences: {
  servings: number
  maxCookTime: number
  avoidAllergens?: string[]
}) {
  const days = 7
  const meals = []

  for (let day = 0; day < days; day++) {
    // Search for a suitable recipe
    const results = await collection.query({
      queryTexts: ["dinner recipe"],
      nResults: 10,
      where: {
        $and: [
          { cookTimeMinutes: { $lte: preferences.maxCookTime } },
          { mealTypes: { $contains: "DINNER" } },
        ],
      },
    })

    // Pick a random recipe from results
    const selectedId = results.ids[0][
      Math.floor(Math.random() * results.ids[0].length)
    ]

    // Fetch full recipe from PostgreSQL
    const [recipe] = await sql`
      SELECT * FROM recipes WHERE id = ${selectedId}
    `

    meals.push({
      day: day + 1,
      date: new Date(Date.now() + day * 24 * 60 * 60 * 1000),
      recipe: recipe.title,
      recipeId: recipe.id,
    })
  }

  return meals
}
```

### Phase 3: Shopping List Generator

Implement the shopping list algorithm:

```typescript
// shopping-list.ts
async function generateShoppingList(mealPlanId: string) {
  // Get all planned meals
  const meals = await sql`
    SELECT pm.*, r.raw_data
    FROM planned_meals pm
    JOIN recipes r ON pm.recipe_id = r.id
    WHERE pm.meal_plan_id = ${mealPlanId}
  `

  // Aggregate ingredients
  const ingredients = new Map()

  for (const meal of meals) {
    const recipe = meal.raw_data
    const scaleFactor = meal.servings / recipe.defaultServings

    for (const ing of recipe.ingredients) {
      const key = ing.normalizedName
      const scaled = ing.quantity * scaleFactor

      if (ingredients.has(key)) {
        ingredients.get(key).quantity += scaled
      } else {
        ingredients.set(key, {
          name: ing.name,
          quantity: scaled,
          unit: ing.unit,
          category: ing.category || "OTHER",
        })
      }
    }
  }

  // Insert into shopping_lists table
  const [list] = await sql`
    INSERT INTO shopping_lists (meal_plan_id, name)
    VALUES (${mealPlanId}, 'Shopping List - ' || CURRENT_DATE)
    RETURNING id
  `

  // Insert items
  for (const [key, item] of ingredients.entries()) {
    await sql`
      INSERT INTO shopping_list_items (
        shopping_list_id, ingredient_name, display_name,
        total_quantity, unit, category
      ) VALUES (
        ${list.id}, ${key}, ${item.name},
        ${item.quantity}, ${item.unit}, ${item.category}
      )
    `
  }

  return list.id
}
```

### Phase 4: AI-Powered Meal Curation

Use an LLM to intelligently select meals:

```typescript
// ai-meal-curator.ts
import Anthropic from "@anthropic-ai/sdk"

async function curateWithAI(preferences: {
  days: number
  dietaryRestrictions: string[]
  budget?: number
  familySize: number
}) {
  const anthropic = new Anthropic()

  // Get candidate recipes from ChromaDB
  const candidates = await collection.query({
    queryTexts: [
      `dinner recipes for ${preferences.familySize} people 
       with ${preferences.dietaryRestrictions.join(", ")} diet`,
    ],
    nResults: 50,
    where: buildFilterFromPreferences(preferences),
  })

  // Fetch full recipe details
  const recipeDetails = await sql`
    SELECT id, title, description, cook_time_minutes,
           main_protein, ingredients, nutrition
    FROM recipes_with_stats
    WHERE id = ANY(${candidates.ids[0]})
  `

  // Ask Claude to curate the meal plan
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `
        I need to plan meals for ${preferences.days} days.
        
        Family size: ${preferences.familySize}
        Dietary restrictions: ${preferences.dietaryRestrictions.join(", ")}
        ${preferences.budget ? `Budget: $${preferences.budget}` : ""}
        
        Available recipes:
        ${JSON.stringify(recipeDetails, null, 2)}
        
        Please:
        1. Select ${preferences.days} recipes that provide variety
        2. Balance quick/easy with longer/complex meals
        3. Avoid repeating the same protein more than twice
        4. Reuse ingredients where possible to minimize waste
        5. Stay within budget if specified
        
        Return a JSON array of recipe IDs in the recommended order.
      `,
    }],
  })

  const selectedIds = JSON.parse(response.content[0].text)

  // Create meal plan in database
  const [plan] = await sql`
    INSERT INTO meal_plans (name, start_date, end_date)
    VALUES (
      'AI Curated - ' || CURRENT_DATE,
      CURRENT_DATE,
      CURRENT_DATE + ${preferences.days}
    )
    RETURNING id
  `

  // Add planned meals
  for (let i = 0; i < selectedIds.length; i++) {
    await sql`
      INSERT INTO planned_meals (
        meal_plan_id, recipe_id, scheduled_date,
        meal_type, servings
      ) VALUES (
        ${plan.id}, ${selectedIds[i]},
        CURRENT_DATE + ${i},
        'DINNER', ${preferences.familySize}
      )
    `
  }

  return plan.id
}
```

### Phase 5: Web Interface (Optional)

Build a simple web UI with:

1. **Recipe Browser** - Search and view recipes
2. **Meal Planner** - Drag-and-drop calendar interface
3. **Shopping List** - Checkable list organized by category
4. **Favorites** - Save and rate recipes

Frameworks to consider:

- **Next.js** (you already have this in your project)
- **Astro** (you have shanewade-v2/web using Astro)
- **SvelteKit**
- **Remix**

## 📊 Understanding Your Data

### Recipe Providers in Your Collection

Based on your OCR data, you have recipes from:

- **GREEN CHEF** - Premium organic ingredients, detailed instructions
- **HELLO FRESH** - Popular meal kits, good variety
- **HOME CHEF** - Flexible customization options
- **EVERYPLATE** - Budget-friendly, simpler recipes

### Common Patterns

**Ingredient Quantities:**

- Most recipes provide 2-serving and 4-serving options
- Quantities use fractions (e.g., "3 1/2 oz", "1/4 cup")
- Some items marked with allergen indicators (e.g., "(1)")

**Steps Format:**

- Usually organized with section headings (e.g., "## PREP", "## COOK")
- Include timing, temperature, and visual cues
- Often have pro tips and notes

**Metadata:**

- Cook times range from 20-50 minutes
- Difficulty levels: EASY, INTERMEDIATE
- Spice levels: NOT_SPICY to VERY_SPICY
- Dietary info varies by provider

## 🐛 Troubleshooting

### Parsing Issues

If recipes aren't parsing correctly:

1. **Check confidence scores** - Low scores indicate parsing problems
2. **Review warnings** - The parser outputs warnings for missing fields
3. **Examine raw OCR text** - Sometimes OCR misreads the cards

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Check ChromaDB is running
curl http://localhost:8000/api/v1/heartbeat
```

### Performance Tips

1. **Index frequently queried fields** - Already included in schema
2. **Batch insert recipes** - Use transactions for multiple inserts
3. **Cache ChromaDB results** - For repeated queries
4. **Use database views** - Pre-defined views are in the schema

## 📚 Additional Resources

### TypeScript Types

All types are exported from `recipe-schema.ts`. Import them:

```typescript
import type { Ingredient, MealPlan, Recipe } from "./recipe-schema.ts"
```

### SQL Functions

The schema includes helper functions:

- `search_recipes(query)` - Full-text search
- `get_recipe_ingredients(recipe_id)` - Get ingredients for a recipe

### Database Views

Pre-built views for common queries:

- `popular_recipes` - With cook counts and ratings
- `recipes_with_stats` - With ingredient/step counts
- `upcoming_meals` - Future scheduled meals

## 🎉 What You've Accomplished

✅ Extracted structured data from OCR'd recipe cards\
✅ Created a comprehensive database schema\
✅ Set up semantic search with ChromaDB\
✅ Built a foundation for meal planning\
✅ Enabled shopping list generation

## 🚀 What's Next?

1. **Parse all your recipes** - You have 25 done, how many more?
2. **Build the meal planning algorithm** - Use AI or rule-based approach
3. **Create shopping list optimizer** - Minimize trips and cost
4. **Add user interface** - Make it easy to use
5. **Enhance with AI** - Use Claude to suggest recipes

---

**Questions or issues?** Refer to `RECIPE_SCHEMA_README.md` for detailed
documentation.

**Good luck with your meal planning system! 🍽️**
