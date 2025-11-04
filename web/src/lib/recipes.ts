/**
 * Helper functions to query recipes from the database
 */

import type { Supabase } from "./db/supabase-client.ts"

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
        position
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

export async function getAllRecipes(supabase: Supabase) {
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select(`
      id,
      title,
      subtitle,
      company_name,
      servings,
      cook_time,
      created_at
    `)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch recipes: ${error.message}`)
  }

  return recipes
}

export async function searchRecipes(supabase: Supabase, query: string) {
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select(`
      id,
      title,
      subtitle,
      company_name,
      cook_time
    `)
    .or(`title.ilike.%${query}%,subtitle.ilike.%${query}%`)
    .order("title")

  if (error) {
    throw new Error(`Failed to search recipes: ${error.message}`)
  }

  return recipes
}

/**
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
        existing.quantity += ingredient.quantity
      } else {
        ingredientMap.set(key, {
          quantity: ingredient.quantity,
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

export async function testGetGroceryListFromRecipes(supabase: Supabase) {
  const recipeIds = [
    "01ba27a8-c9a1-4588-81e9-560381469163",
    "089e2c77-f9a6-4d6c-bb38-11b2e088c001",
    "093cfd57-dec3-40e3-9ab1-204160a5a332",
    "14e5736a-1695-4807-a004-18bc8698c2d7",
    "20d07266-0198-4af5-a4da-3302154685aa",
    "275ae86f-21fd-4d7b-82ba-541e7dc8fa15",
    "3447dad9-aae8-4083-847c-6c08d6b06f00",
  ]

  const recipes = await Promise.all(recipeIds.map(async (id) => await getRecipe(supabase, id)))

  const groceryList = getGroceryListFromRecipes(recipes)

  Deno.writeTextFileSync("recipes.json", JSON.stringify(recipes, null, 2))

  Deno.writeTextFileSync("grocery-list.json", JSON.stringify(groceryList, null, 2))

  console.log(`Wrote grocery list to grocery-list.json`)
}
