/**
 * Helper functions to query recipes from the database
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export async function getRecipe(supabase: SupabaseClient, recipeId: string) {
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

export async function getAllRecipes(supabase: SupabaseClient) {
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

export async function searchRecipes(supabase: SupabaseClient, query: string) {
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
