/**
 * Recipe Data Schema
 *
 * This schema is designed to:
 * 1. Support multiple recipe providers (Green Chef, Hello Fresh, Home Chef, etc.)
 * 2. Enable semantic search in ChromaDB
 * 3. Store structured data in PostgreSQL
 * 4. Support meal planning and shopping list generation
 */

// ============================================================================
// Core Types
// ============================================================================

export type RecipeProvider =
  | "GREEN_CHEF"
  | "HELLO_FRESH"
  | "MARLEY_SPOON"
  | "DINNERLY"
  | "HOME_CHEF"
  | "GOBBLE"
  | "EVERYPLATE"
  | "BLUE_APRON"
  | "OTHER"

export type DifficultyLevel =
  | "EASY"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "QUICK"

export type SpiceLevel =
  | "NOT_SPICY"
  | "MILD"
  | "MEDIUM"
  | "SPICY"
  | "VERY_SPICY"

export type MealType =
  | "BREAKFAST"
  | "LUNCH"
  | "DINNER"
  | "SNACK"
  | "DESSERT"
  | "APPETIZER"

export type DietaryTag =
  | "VEGETARIAN"
  | "VEGAN"
  | "GLUTEN_FREE"
  | "DAIRY_FREE"
  | "KETO"
  | "LOW_CARB"
  | "HIGH_PROTEIN"
  | "ORGANIC"
  | "PESCATARIAN"
  | "PALEO"

// ============================================================================
// Ingredient Types
// ============================================================================

export type IngredientUnit =
  | "oz"
  | "lb"
  | "g"
  | "kg" // Weight
  | "cup"
  | "tbsp"
  | "tsp"
  | "ml"
  | "l"
  | "fl. oz" // Volume
  | "whole"
  | "piece"
  | "clove" // Count
  | "pinch"
  | "dash" // Approximate
  | "to taste" // Variable
  | "" // No unit (like "salt and pepper")

export interface Ingredient {
  /** Unique identifier for the ingredient */
  id: string

  /** Name of the ingredient (e.g., "Kale", "Pork filet", "Garlic") */
  name: string

  /** Normalized/cleaned name for matching (lowercase, singular) */
  normalizedName: string

  /** Raw quantity as string (e.g., "3 1/2", "1-2", "1/4") */
  rawQuantity: string

  /** Parsed numeric quantity (convert fractions to decimals) */
  quantity: number

  /** Unit of measurement */
  unit: IngredientUnit

  /** Number of servings this quantity is for */
  servings: number

  /** Preparation instructions (e.g., "diced", "chopped", "cooked") */
  preparation?: string

  /** Optional notes (e.g., "(1)" for allergen markers) */
  notes?: string

  /** Whether this is an optional ingredient */
  optional: boolean

  /** Category for grouping (produce, protein, dairy, pantry, etc.) */
  category?: IngredientCategory

  /** Allergen markers referenced in the recipe */
  allergenMarkers?: string[]
}

export type IngredientCategory =
  | "PRODUCE"
  | "PROTEIN"
  | "DAIRY"
  | "GRAINS"
  | "PANTRY"
  | "SPICES"
  | "CONDIMENTS"
  | "FROZEN"
  | "OTHER"

// ============================================================================
// Instruction/Step Types
// ============================================================================

export interface RecipeStep {
  /** Step number/order */
  stepNumber: number

  /** Title/heading of the step (e.g., "PREP", "SEASON & COOK PORK") */
  title?: string

  /** Full instruction text */
  instruction: string

  /** Cooking time for this step (in minutes) */
  estimatedTime?: number

  /** Temperature if specified (e.g., 400 for 400°F) */
  temperature?: number

  /** Temperature unit (F or C) */
  temperatureUnit?: "F" | "C"

  /** Equipment needed for this step */
  equipment?: string[]

  /** Ingredients primarily used in this step (references to ingredient IDs) */
  ingredientIds?: string[]

  /** Visual cues mentioned (e.g., "until lightly browned", "fully cooked") */
  visualCues?: string[]

  /** Pro tips or notes for this step */
  tips?: string[]
}

// ============================================================================
// Nutritional Information
// ============================================================================

export interface NutritionalInfo {
  /** Calories per serving */
  caloriesPerServing?: number

  /** Serving size */
  servingSize?: string

  /** Macronutrients */
  protein?: string
  fat?: string
  carbohydrates?: string
  fiber?: string
  sugar?: string
  sodium?: string

  /** Additional nutritional details */
  cholesterol?: string
  saturatedFat?: string
  transFat?: string
}

// ============================================================================
// Main Recipe Schema
// ============================================================================

export interface Recipe {
  // -------------------- Identity --------------------
  /** Unique identifier for the recipe */
  id: string

  /** Recipe title */
  title: string

  /** Recipe provider/source */
  provider: RecipeProvider

  /** Date the recipe was added to the system */
  createdAt: Date

  /** Date the recipe was last updated */
  updatedAt: Date

  // -------------------- OCR Metadata --------------------
  /** Reference to the original OCR batch ID */
  ocrBatchId?: string

  /** Reference to the original custom ID */
  ocrCustomId?: string

  /** Path to original scanned image(s) */
  originalImagePaths: string[]

  /** Full OCR markdown text (for reference) */
  rawOcrText?: string

  // -------------------- Description & Content --------------------
  /** Short description of the recipe */
  description: string

  /** Subtitle or tagline (e.g., "with Dark Meat Chicken, Carrots & Celery") */
  subtitle?: string

  /** Extended description or story */
  extendedDescription?: string

  // -------------------- Classification --------------------
  /** Meal type(s) */
  mealTypes: MealType[]

  /** Dietary tags */
  dietaryTags: DietaryTag[]

  /** Cuisine type (e.g., "Mexican", "Italian", "Asian Fusion") */
  cuisineType?: string

  /** Main protein (e.g., "Pork", "Chicken", "Beef", "Vegetarian") */
  mainProtein?: string

  // -------------------- Cooking Details --------------------
  /** Total cooking time in minutes */
  cookTimeMinutes: number

  /** Prep time in minutes (if specified separately) */
  prepTimeMinutes?: number

  /** Active cooking time vs passive time */
  activeTimeMinutes?: number

  /** Difficulty level */
  difficultyLevel?: DifficultyLevel

  /** Spice level */
  spiceLevel?: SpiceLevel

  /** Number of servings (common options: 2, 4, 6) */
  defaultServings: number

  /** Available serving size options */
  availableServings: number[]

  // -------------------- Ingredients --------------------
  /** List of ingredients */
  ingredients: Ingredient[]

  // -------------------- Instructions --------------------
  /** Cooking steps/instructions */
  steps: RecipeStep[]

  // -------------------- Equipment & Requirements --------------------
  /** Required equipment */
  equipment: string[]

  /** Common pantry items needed (salt, pepper, oil, etc.) */
  pantryItems: string[]

  /** Prep time window (e.g., "Cook Within 3 DAYS") */
  cookWithinDays?: number

  // -------------------- Allergens --------------------
  /** List of allergens (Milk, Wheat, Soy, etc.) */
  allergens: string[]

  // -------------------- Nutrition --------------------
  /** Nutritional information */
  nutrition: NutritionalInfo

  // -------------------- Customization --------------------
  /** Available protein swaps/customizations */
  proteinCustomizations?: string[]

  /** Other customization options */
  otherCustomizations?: string[]

  // -------------------- Images --------------------
  /** Extracted image references from OCR */
  images: RecipeImage[]

  // -------------------- Tips & Notes --------------------
  /** Pro tips mentioned in the recipe */
  tips: string[]

  /** Special notes or warnings */
  notes: string[]

  /** Temperature safety notes */
  safetyNotes: string[]

  // -------------------- Search & Tags --------------------
  /** Keywords for search (auto-generated from title, description, ingredients) */
  searchKeywords: string[]

  /** Custom tags added by user or system */
  customTags: string[]

  // -------------------- User Data --------------------
  /** User rating (1-5) */
  userRating?: number

  /** User notes */
  userNotes?: string

  /** Times this recipe has been cooked */
  timesCooked: number

  /** Last time this recipe was cooked */
  lastCookedDate?: Date

  /** Whether user has favorited this recipe */
  isFavorite: boolean
}

export interface RecipeImage {
  /** Image ID from OCR */
  id: string

  /** Path to the extracted/processed image */
  imagePath?: string

  /** Image URL if hosted */
  imageUrl?: string

  /** Bounding box coordinates from OCR */
  boundingBox?: {
    topLeftX: number
    topLeftY: number
    bottomRightX: number
    bottomRightY: number
  }

  /** Image type (hero, step, ingredient, etc.) */
  imageType?: "HERO" | "STEP" | "INGREDIENT" | "OTHER"

  /** Alt text for accessibility */
  altText?: string
}

// ============================================================================
// Shopping List & Meal Planning Types
// ============================================================================

export interface MealPlan {
  /** Unique identifier */
  id: string

  /** Name of the meal plan (e.g., "Week of Oct 28, 2025") */
  name: string

  /** Start date */
  startDate: Date

  /** End date */
  endDate: Date

  /** Planned meals */
  plannedMeals: PlannedMeal[]

  /** Generated shopping list */
  shoppingListId?: string

  /** Total estimated calories for the plan */
  totalCalories?: number

  /** User who created this plan */
  userId?: string

  /** Creation timestamp */
  createdAt: Date
}

export interface PlannedMeal {
  /** Unique identifier */
  id: string

  /** Recipe ID */
  recipeId: string

  /** Date and time for this meal */
  scheduledDate: Date

  /** Meal type */
  mealType: MealType

  /** Number of servings to make */
  servings: number

  /** Notes for this meal */
  notes?: string

  /** Whether this meal has been completed */
  completed: boolean
}

export interface ShoppingList {
  /** Unique identifier */
  id: string

  /** Associated meal plan ID */
  mealPlanId: string

  /** Name of the shopping list */
  name: string

  /** Shopping list items */
  items: ShoppingListItem[]

  /** Creation timestamp */
  createdAt: Date

  /** Last updated timestamp */
  updatedAt: Date

  /** Whether the shopping trip is complete */
  completed: boolean
}

export interface ShoppingListItem {
  /** Unique identifier */
  id: string

  /** Normalized ingredient name */
  ingredientName: string

  /** Display name */
  displayName: string

  /** Total quantity needed (aggregated across recipes) */
  totalQuantity: number

  /** Unit */
  unit: IngredientUnit

  /** Category for store organization */
  category: IngredientCategory

  /** Which recipes need this ingredient */
  recipeIds: string[]

  /** Whether this item has been checked off */
  checked: boolean

  /** Estimated cost (if available) */
  estimatedCost?: number

  /** Notes */
  notes?: string
}

// ============================================================================
// Database Storage Strategy
// ============================================================================

/**
 * CHROMADB STORAGE:
 * ----------------
 * Store for semantic search and retrieval. Each recipe should be stored as:
 *
 * Documents (text to embed):
 * - Recipe title + subtitle
 * - Description + extended description
 * - Ingredient list (formatted as text)
 * - Cooking instructions (formatted as text)
 *
 * Metadata (for filtering):
 * - provider
 * - mealTypes (array)
 * - dietaryTags (array)
 * - cuisineType
 * - mainProtein
 * - cookTimeMinutes
 * - difficultyLevel
 * - caloriesPerServing
 * - allergens (array)
 * - searchKeywords (array)
 *
 * IDs: Use recipe.id
 *
 * This enables queries like:
 * - "Find recipes similar to tacos with pork"
 * - "Quick chicken dinners under 30 minutes"
 * - "Vegetarian meals with high protein"
 */

/**
 * POSTGRESQL STORAGE:
 * ------------------
 * Store complete structured data for:
 *
 * Tables:
 * 1. recipes (main recipe data, JSON columns for complex types)
 * 2. ingredients (normalized ingredient master list)
 * 3. recipe_ingredients (junction table with quantities)
 * 4. meal_plans
 * 5. planned_meals
 * 6. shopping_lists
 * 7. shopping_list_items
 * 8. recipe_images
 * 9. user_recipe_data (ratings, notes, favorites, cook count)
 *
 * Indexes:
 * - recipes: provider, mealTypes, cookTimeMinutes, mainProtein
 * - ingredients: normalizedName, category
 * - Full-text search on: title, description, ingredient names
 */

// ============================================================================
// Utility Types for Parsing
// ============================================================================

export interface ParsedRecipeData {
  /** The structured recipe */
  recipe: Recipe

  /** Any parsing warnings or issues */
  warnings: string[]

  /** Confidence score (0-1) for the parsing quality */
  confidenceScore: number

  /** Fields that couldn't be parsed */
  unparsedFields: string[]
}

export interface IngredientParsingRules {
  /** Common abbreviations */
  abbreviations: Record<string, string>

  /** Unit conversions */
  unitConversions: Record<string, { to: string; factor: number }>

  /** Common preparation verbs */
  preparationVerbs: string[]

  /** Ingredient category mappings */
  categoryMappings: Record<string, IngredientCategory>
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  Ingredient,
  IngredientParsingRules,
  MealPlan,
  NutritionalInfo,
  ParsedRecipeData,
  PlannedMeal,
  Recipe,
  RecipeImage,
  RecipeStep,
  ShoppingList,
  ShoppingListItem,
}
