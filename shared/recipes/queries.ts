/**
 * Recipe query functions
 */

import type { Supabase } from "../db/client.ts"

/**
 * Get a single recipe by ID with all related data
 */
export async function getRecipe(supabase: Supabase, recipeId: string) {
  // Fetch recipe with all related data
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select(`
      *,
      ingredients (
        id,
        display_name,
        quantity,
        unit,
        position,
        is_pantry_staple,
        preparation_note
      ),
      steps (
        id,
        title,
        details,
        position
      ),
      mise_en_place_steps (
        id,
        title,
        details,
        position
      ),
      cooking_tools (
        id,
        display_name,
        position
      )
    `)
    .eq("id", recipeId)
    .single()

  if (recipeError) {
    throw new Error(`Failed to fetch recipe: ${recipeError.message}`)
  }

  if (!recipe) {
    return null
  }

  // Sort arrays by position
  recipe.ingredients?.sort((a, b) => a.position - b.position)
  recipe.steps?.sort((a, b) => a.position - b.position)
  recipe.mise_en_place_steps?.sort((a, b) => a.position - b.position)
  recipe.cooking_tools?.sort((a, b) => a.position - b.position)

  return recipe
}

export type Recipe = Awaited<ReturnType<typeof getRecipe>>

/**
 * Get all recipes (summary view)
 */
export async function getAllRecipes(supabase: Supabase) {
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select(`
      id,
      title,
      subtitle,
      company_name,
      servings,
      cook_time_minutes,
      created_at
    `)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch recipes: ${error.message}`)
  }

  return recipes
}

/**
 * Search recipes by title or subtitle
 */
export async function searchRecipes(supabase: Supabase, query: string) {
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select(`
      id,
      title,
      subtitle,
      company_name,
      cook_time_minutes
    `)
    .or(`title.ilike.%${query}%,subtitle.ilike.%${query}%`)
    .order("title")

  if (error) {
    throw new Error(`Failed to search recipes: ${error.message}`)
  }

  return recipes
}

/**
 * Get a grocery list from multiple recipes
 * @param recipes - A list of recipes to get the grocery list from
 * @returns A record of ingredient names to their formatted quantities with units
 */
export function getGroceryListFromRecipes(recipes: Awaited<ReturnType<typeof getRecipe>>[]) {
  // Create a map to group ingredients by display_name and unit
  const ingredientMap = new Map<string, { quantity: number; unit: string | null; displayName: string }>()

  // Loop through all recipes and their ingredients
  for (const recipe of recipes) {
    if (!recipe?.ingredients) continue

    for (const ingredient of recipe.ingredients) {
      // Create a unique key combining display name and unit
      // This ensures we don't mix "1 cup water" with "2 oz water"
      const key = `${ingredient.display_name}|${ingredient.unit || "none"}`

      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!
        existing.quantity += ingredient.quantity ?? 0
      } else {
        ingredientMap.set(key, {
          quantity: ingredient.quantity ?? 0,
          unit: ingredient.unit,
          displayName: ingredient.display_name,
        })
      }
    }
  }

  // Convert to a record with formatted strings
  const groceryList: Record<string, string> = {}

  // Sort entries by display name for easier reading
  const sortedEntries = Array.from(ingredientMap.entries()).sort((a, b) =>
    a[1].displayName.localeCompare(b[1].displayName)
  )

  for (const [_, item] of sortedEntries) {
    // Handle items with no quantity (like salt, pepper, cooking oil)
    if (item.quantity === 0 && !item.unit) {
      groceryList[item.displayName] = "as needed"
      continue
    }

    // Format quantity to avoid unnecessary decimals
    let formattedQty: string
    if (item.quantity % 1 === 0) {
      formattedQty = item.quantity.toString()
    } else {
      // Round to 2 decimal places and remove trailing zeros
      formattedQty = parseFloat(item.quantity.toFixed(2)).toString()
    }

    // Build the final formatted string
    const formattedValue = item.unit ? `${formattedQty} ${item.unit}` : formattedQty

    // If multiple entries exist for same ingredient (different units),
    // append to existing entry
    if (groceryList[item.displayName]) {
      groceryList[item.displayName] += ` + ${formattedValue}`
    } else {
      groceryList[item.displayName] = formattedValue
    }
  }

  return groceryList
}

