/**
 * ChromaDB Integration Example
 *
 * This demonstrates how to:
 * 1. Set up ChromaDB for recipe storage
 * 2. Format recipes for embedding
 * 3. Query recipes semantically
 * 4. Filter by metadata
 */

import type { MealType, Recipe, RecipeProvider } from "./recipe-schema.ts"

// ============================================================================
// ChromaDB Setup
// ============================================================================

/**
 * Initialize ChromaDB collection for recipes
 *
 * Note: Install ChromaDB first:
 * npm install chromadb
 * or
 * yarn add chromadb
 */

interface ChromaClient {
  createCollection(options: any): Promise<ChromaCollection>
  getCollection(options: any): Promise<ChromaCollection>
}

interface ChromaCollection {
  add(data: {
    ids: string[]
    documents: string[]
    metadatas?: Record<string, any>[]
    embeddings?: number[][]
  }): Promise<void>

  query(params: {
    queryTexts?: string[]
    queryEmbeddings?: number[][]
    nResults?: number
    where?: Record<string, any>
    whereDocument?: Record<string, any>
  }): Promise<{
    ids: string[][]
    documents: string[][]
    metadatas: Record<string, any>[][]
    distances: number[][]
  }>

  update(data: {
    ids: string[]
    documents?: string[]
    metadatas?: Record<string, any>[]
  }): Promise<void>

  delete(
    params: { ids?: string[]; where?: Record<string, any> },
  ): Promise<void>

  count(): Promise<number>
}

/**
 * Setup ChromaDB collection
 */
export async function setupRecipeCollection(
  client: ChromaClient,
  collectionName = "recipes",
): Promise<ChromaCollection> {
  try {
    // Try to get existing collection
    return await client.getCollection({ name: collectionName })
  } catch {
    // Create new collection if it doesn't exist
    return await client.createCollection({
      name: collectionName,
      metadata: {
        "hnsw:space": "cosine", // Use cosine similarity
        description: "Recipe collection for semantic search",
      },
    })
  }
}

// ============================================================================
// Document Formatting
// ============================================================================

/**
 * Format a recipe into a document string for embedding
 *
 * This creates a rich text representation that captures:
 * - Title and description
 * - Key ingredients
 * - Cooking method summary
 * - Flavor profile
 */
export function formatRecipeForEmbedding(recipe: Recipe): string {
  const parts: string[] = []

  // Title and subtitle
  parts.push(`Recipe: ${recipe.title}`)
  if (recipe.subtitle) {
    parts.push(recipe.subtitle)
  }

  // Description
  if (recipe.description) {
    parts.push(`\nDescription: ${recipe.description}`)
  }

  // Main protein and cuisine
  if (recipe.mainProtein) {
    parts.push(`\nMain Protein: ${recipe.mainProtein}`)
  }
  if (recipe.cuisineType) {
    parts.push(`Cuisine: ${recipe.cuisineType}`)
  }

  // Dietary tags
  if (recipe.dietaryTags.length > 0) {
    parts.push(`\nDiet: ${recipe.dietaryTags.join(", ")}`)
  }

  // Key ingredients (top 10)
  const topIngredients = recipe.ingredients
    .slice(0, 10)
    .map((ing) => ing.name)
    .join(", ")
  parts.push(`\nKey Ingredients: ${topIngredients}`)

  // Cooking style/methods (extracted from steps)
  const cookingMethods = extractCookingMethods(recipe.steps)
  if (cookingMethods.length > 0) {
    parts.push(`\nCooking Methods: ${cookingMethods.join(", ")}`)
  }

  // Brief instruction summary (first 200 chars of first step)
  if (recipe.steps.length > 0) {
    const firstStep = recipe.steps[0].instruction.slice(0, 200)
    parts.push(`\nPreparation: ${firstStep}...`)
  }

  return parts.join(" ")
}

/**
 * Extract cooking methods from recipe steps
 */
function extractCookingMethods(steps: any[]): string[] {
  const methods = new Set<string>()
  const methodKeywords = [
    "bake",
    "roast",
    "grill",
    "sauté",
    "fry",
    "boil",
    "simmer",
    "steam",
    "broil",
    "toast",
    "blend",
    "mix",
  ]

  for (const step of steps) {
    const instruction = step.instruction.toLowerCase()
    for (const method of methodKeywords) {
      if (instruction.includes(method)) {
        methods.add(method)
      }
    }
  }

  return Array.from(methods)
}

/**
 * Extract metadata for filtering
 *
 * ChromaDB supports filtering on metadata fields during queries
 */
export function extractRecipeMetadata(recipe: Recipe): Record<string, any> {
  return {
    // Identity
    provider: recipe.provider,
    recipeId: recipe.id,

    // Classification
    mealTypes: recipe.mealTypes,
    dietaryTags: recipe.dietaryTags,
    cuisineType: recipe.cuisineType || "unknown",
    mainProtein: recipe.mainProtein || "unknown",

    // Cooking details
    cookTimeMinutes: recipe.cookTimeMinutes,
    difficultyLevel: recipe.difficultyLevel || "INTERMEDIATE",
    spiceLevel: recipe.spiceLevel || "NOT_SPICY",
    defaultServings: recipe.defaultServings,

    // Nutrition
    caloriesPerServing: recipe.nutrition.caloriesPerServing || 0,

    // Allergens (for filtering)
    allergens: recipe.allergens,
    hasAllergens: recipe.allergens.length > 0,

    // Counts
    ingredientCount: recipe.ingredients.length,
    stepCount: recipe.steps.length,

    // Flags
    isQuick: recipe.cookTimeMinutes < 30,
    isEasy: recipe.difficultyLevel === "EASY",
    isVegetarian: recipe.dietaryTags.includes("VEGETARIAN"),
    isVegan: recipe.dietaryTags.includes("VEGAN"),
    isGlutenFree: recipe.dietaryTags.includes("GLUTEN_FREE"),

    // Timestamps (as Unix timestamp for ChromaDB)
    createdAt: Math.floor(recipe.createdAt.getTime() / 1000),
    updatedAt: Math.floor(recipe.updatedAt.getTime() / 1000),
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Add multiple recipes to ChromaDB
 */
export async function addRecipesToChroma(
  collection: ChromaCollection,
  recipes: Recipe[],
): Promise<void> {
  if (recipes.length === 0) return

  const ids = recipes.map((r) => r.id)
  const documents = recipes.map((r) => formatRecipeForEmbedding(r))
  const metadatas = recipes.map((r) => extractRecipeMetadata(r))

  // Add in batches of 100 (ChromaDB recommendation)
  const batchSize = 100
  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = {
      ids: ids.slice(i, i + batchSize),
      documents: documents.slice(i, i + batchSize),
      metadatas: metadatas.slice(i, i + batchSize),
    }

    await collection.add(batch)
    console.log(
      `Added recipes ${i + 1} to ${Math.min(i + batchSize, recipes.length)}`,
    )
  }
}

/**
 * Update a recipe in ChromaDB
 */
export async function updateRecipeInChroma(
  collection: ChromaCollection,
  recipe: Recipe,
): Promise<void> {
  await collection.update({
    ids: [recipe.id],
    documents: [formatRecipeForEmbedding(recipe)],
    metadatas: [extractRecipeMetadata(recipe)],
  })
}

/**
 * Delete recipes from ChromaDB
 */
export async function deleteRecipesFromChroma(
  collection: ChromaCollection,
  recipeIds: string[],
): Promise<void> {
  await collection.delete({ ids: recipeIds })
}

// ============================================================================
// Query Examples
// ============================================================================

/**
 * Search recipes by natural language query
 */
export async function searchRecipes(
  collection: ChromaCollection,
  query: string,
  options: {
    limit?: number
    filters?: Record<string, any>
  } = {},
): Promise<{
  ids: string[]
  documents: string[]
  metadatas: Record<string, any>[]
  distances: number[]
}> {
  const result = await collection.query({
    queryTexts: [query],
    nResults: options.limit || 10,
    where: options.filters,
  })

  return {
    ids: result.ids[0] || [],
    documents: result.documents[0] || [],
    metadatas: result.metadatas[0] || [],
    distances: result.distances[0] || [],
  }
}

/**
 * Example: Find quick chicken dinners
 */
export async function findQuickChickenDinners(
  collection: ChromaCollection,
): Promise<any> {
  return await searchRecipes(
    collection,
    "quick and easy chicken dinner recipes",
    {
      limit: 10,
      filters: {
        $and: [
          { cookTimeMinutes: { $lt: 40 } },
          { mainProtein: "Chicken" },
          { mealTypes: { $contains: "DINNER" } },
        ],
      },
    },
  )
}

/**
 * Example: Find vegetarian meals with specific ingredients
 */
export async function findVegetarianWithIngredients(
  collection: ChromaCollection,
  ingredientQuery: string,
): Promise<any> {
  return await searchRecipes(
    collection,
    `vegetarian recipe with ${ingredientQuery}`,
    {
      limit: 10,
      filters: {
        isVegetarian: true,
      },
    },
  )
}

/**
 * Example: Find recipes by cuisine and spice level
 */
export async function findByCuisineAndSpice(
  collection: ChromaCollection,
  cuisine: string,
  maxSpiceLevel: string,
): Promise<any> {
  return await searchRecipes(
    collection,
    `${cuisine} cuisine recipes`,
    {
      limit: 10,
      filters: {
        cuisineType: cuisine,
        spiceLevel: { $in: ["NOT_SPICY", "MILD"] },
      },
    },
  )
}

/**
 * Example: Find recipes without specific allergens
 */
export async function findWithoutAllergens(
  collection: ChromaCollection,
  query: string,
  avoidAllergens: string[],
): Promise<any> {
  return await searchRecipes(collection, query, {
    limit: 10,
    filters: {
      $and: avoidAllergens.map((allergen) => ({
        allergens: { $nin: [allergen] },
      })),
    },
  })
}

/**
 * Example: Find similar recipes to a given recipe
 */
export async function findSimilarRecipes(
  collection: ChromaCollection,
  recipe: Recipe,
  limit = 5,
): Promise<any> {
  const document = formatRecipeForEmbedding(recipe)

  const result = await collection.query({
    queryTexts: [document],
    nResults: limit + 1, // +1 to exclude the original recipe
    where: {
      recipeId: { $ne: recipe.id }, // Exclude the original recipe
    },
  })

  return {
    ids: result.ids[0]?.slice(0, limit) || [],
    documents: result.documents[0]?.slice(0, limit) || [],
    metadatas: result.metadatas[0]?.slice(0, limit) || [],
    distances: result.distances[0]?.slice(0, limit) || [],
  }
}

// ============================================================================
// Advanced Queries with Multiple Filters
// ============================================================================

/**
 * Build a complex filter from user preferences
 */
export interface SearchPreferences {
  maxCookTime?: number
  minCookTime?: number
  difficulty?: string[]
  mealTypes?: MealType[]
  dietaryTags?: string[]
  avoidAllergens?: string[]
  providers?: RecipeProvider[]
  maxCalories?: number
  minCalories?: number
}

export function buildFilterFromPreferences(
  prefs: SearchPreferences,
): Record<string, any> {
  const filters: any[] = []

  // Cook time filters
  if (prefs.maxCookTime !== undefined) {
    filters.push({ cookTimeMinutes: { $lte: prefs.maxCookTime } })
  }
  if (prefs.minCookTime !== undefined) {
    filters.push({ cookTimeMinutes: { $gte: prefs.minCookTime } })
  }

  // Difficulty filter
  if (prefs.difficulty && prefs.difficulty.length > 0) {
    filters.push({ difficultyLevel: { $in: prefs.difficulty } })
  }

  // Meal types filter
  if (prefs.mealTypes && prefs.mealTypes.length > 0) {
    filters.push({
      $or: prefs.mealTypes.map((mt) => ({
        mealTypes: { $contains: mt },
      })),
    })
  }

  // Dietary tags filter
  if (prefs.dietaryTags && prefs.dietaryTags.length > 0) {
    for (const tag of prefs.dietaryTags) {
      filters.push({ dietaryTags: { $contains: tag } })
    }
  }

  // Allergen exclusions
  if (prefs.avoidAllergens && prefs.avoidAllergens.length > 0) {
    for (const allergen of prefs.avoidAllergens) {
      filters.push({ allergens: { $nin: [allergen] } })
    }
  }

  // Provider filter
  if (prefs.providers && prefs.providers.length > 0) {
    filters.push({ provider: { $in: prefs.providers } })
  }

  // Calorie filters
  if (prefs.maxCalories !== undefined) {
    filters.push({ caloriesPerServing: { $lte: prefs.maxCalories } })
  }
  if (prefs.minCalories !== undefined) {
    filters.push({ caloriesPerServing: { $gte: prefs.minCalories } })
  }

  // Combine all filters with $and
  return filters.length > 0 ? { $and: filters } : {}
}

/**
 * Advanced search with preferences
 */
export async function advancedSearch(
  collection: ChromaCollection,
  query: string,
  preferences: SearchPreferences,
  limit = 10,
): Promise<any> {
  const filters = buildFilterFromPreferences(preferences)

  return await searchRecipes(collection, query, {
    limit,
    filters,
  })
}

// ============================================================================
// Meal Planning Support
// ============================================================================

/**
 * Find diverse recipes for meal planning
 * Ensures variety in proteins and cuisines
 */
export async function findDiverseRecipes(
  collection: ChromaCollection,
  daysNeeded: number,
  preferences: SearchPreferences,
): Promise<Recipe[]> {
  const recipes: Recipe[] = []
  const usedProteins = new Set<string>()
  const usedCuisines = new Set<string>()

  let attempts = 0
  const maxAttempts = daysNeeded * 3 // Try up to 3x the needed recipes

  while (recipes.length < daysNeeded && attempts < maxAttempts) {
    attempts++

    // Search for recipes
    const result = await advancedSearch(
      collection,
      "dinner recipes with variety",
      {
        ...preferences,
        // Could add filters to exclude already selected recipes
      },
      20, // Get more results to choose from
    )

    // Select recipes with diversity
    for (let i = 0; i < result.metadatas.length; i++) {
      const metadata = result.metadatas[i]
      const protein = metadata.mainProtein
      const cuisine = metadata.cuisineType

      // Prioritize new proteins and cuisines
      if (
        (!usedProteins.has(protein) || usedProteins.size < 3) &&
        (!usedCuisines.has(cuisine) || usedCuisines.size < 4)
      ) {
        // Would normally fetch full recipe from Postgres here
        // For now, just track the selection
        usedProteins.add(protein)
        usedCuisines.add(cuisine)

        if (recipes.length >= daysNeeded) break
      }
    }

    if (recipes.length >= daysNeeded) break

    // If we're stuck, relax the diversity requirement
    if (attempts > daysNeeded * 2) {
      usedProteins.clear()
      usedCuisines.clear()
    }
  }

  return recipes
}

// ============================================================================
// Analytics & Insights
// ============================================================================

/**
 * Get recipe statistics from ChromaDB
 */
export async function getRecipeStatistics(
  collection: ChromaCollection,
): Promise<{
  totalRecipes: number
  // Add more stats as needed
}> {
  const totalRecipes = await collection.count()

  return {
    totalRecipes,
  }
}

/**
 * Example main function showing usage
 */
export async function exampleUsage() {
  // Note: This is pseudo-code as ChromaDB client setup varies by environment
  console.log("ChromaDB Recipe Integration Example")
  console.log("=====================================")

  // 1. Setup
  console.log("\n1. Setting up ChromaDB collection...")
  // const client = new ChromaClient();
  // const collection = await setupRecipeCollection(client);

  // 2. Add recipes
  console.log("\n2. Adding recipes to ChromaDB...")
  // const recipes = await loadRecipesFromParser();
  // await addRecipesToChroma(collection, recipes);

  // 3. Search examples
  console.log("\n3. Example searches:")
  console.log('   - "Quick chicken dinners"')
  console.log('   - "Vegetarian meals with pasta"')
  console.log('   - "Spicy Asian-inspired recipes"')

  // 4. Advanced search with preferences
  console.log("\n4. Advanced search with preferences:")
  const preferences: SearchPreferences = {
    maxCookTime: 40,
    difficulty: ["EASY", "INTERMEDIATE"],
    dietaryTags: ["VEGETARIAN"],
    avoidAllergens: ["MILK", "WHEAT"],
    maxCalories: 600,
  }
  console.log("   Preferences:", JSON.stringify(preferences, null, 2))

  // 5. Meal planning
  console.log("\n5. Generate diverse meal plan for 7 days...")
  // const mealPlan = await findDiverseRecipes(collection, 7, preferences);

  console.log("\n✅ Integration complete!")
}

// Run example if this is the main module
if (import.meta.main) {
  exampleUsage()
}
