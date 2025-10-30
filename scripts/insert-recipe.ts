/**
 * Helper function to insert recipe JSON data into the database
 *
 * Usage:
 *   import { insertRecipe } from './insert-recipe.ts';
 *   import recipeData from '../save-complete-recipe.json' with { type: 'json' };
 *   await insertRecipe(supabaseClient, recipeData);
 */

import type { SupabaseClient } from "@supabase/supabase-js"

interface RecipeData {
  id: string
  title: string
  subtitle?: string
  servings?: string
  company_name?: string
  cook_time?: string
  cooking_tips?: string
  ingredients: Array<{
    name: string
    quantity: number
    unit: string | null
  }>
  steps: Array<{
    title: string
    details: string
  }>
  mise_en_place_steps: Array<{
    title: string
    details: string
  }>
  cooking_tools: Array<{
    name: string
  }>
  ocr_markdown?: string
  ocr_results?: unknown
  pages?: string[]
}

export async function insertRecipe(
  supabase: SupabaseClient,
  recipeData: RecipeData,
) {
  // Insert the main recipe
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      id: recipeData.id,
      title: recipeData.title,
      subtitle: recipeData.subtitle,
      company_name: recipeData.company_name,
      servings: recipeData.servings,
      cook_time: recipeData.cook_time,
      cooking_tips: recipeData.cooking_tips,
      ocr_markdown: recipeData.ocr_markdown,
      ocr_results: recipeData.ocr_results,
      pages: recipeData.pages,
    })
    .select()
    .single()

  if (recipeError) {
    throw new Error(`Failed to insert recipe: ${recipeError.message}`)
  }

  // Insert ingredients
  if (recipeData.ingredients?.length > 0) {
    const ingredients = recipeData.ingredients.map((ing, index) => ({
      recipe_id: recipe.id,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      position: index,
    }))

    const { error: ingredientsError } = await supabase
      .from("ingredients")
      .insert(ingredients)

    if (ingredientsError) {
      throw new Error(
        `Failed to insert ingredients: ${ingredientsError.message}`,
      )
    }
  }

  // Insert steps
  if (recipeData.steps?.length > 0) {
    const steps = recipeData.steps.map((step, index) => ({
      recipe_id: recipe.id,
      title: step.title,
      details: step.details,
      position: index,
    }))

    const { error: stepsError } = await supabase
      .from("steps")
      .insert(steps)

    if (stepsError) {
      throw new Error(`Failed to insert steps: ${stepsError.message}`)
    }
  }

  // Insert mise en place steps
  if (recipeData.mise_en_place_steps?.length > 0) {
    const miseSteps = recipeData.mise_en_place_steps.map((step, index) => ({
      recipe_id: recipe.id,
      title: step.title,
      details: step.details,
      position: index,
    }))

    const { error: miseError } = await supabase
      .from("mise_en_place_steps")
      .insert(miseSteps)

    if (miseError) {
      throw new Error(
        `Failed to insert mise en place steps: ${miseError.message}`,
      )
    }
  }

  // Insert cooking tools
  if (recipeData.cooking_tools?.length > 0) {
    const tools = recipeData.cooking_tools.map((tool, index) => ({
      recipe_id: recipe.id,
      name: tool.name,
      position: index,
    }))

    const { error: toolsError } = await supabase
      .from("cooking_tools")
      .insert(tools)

    if (toolsError) {
      throw new Error(
        `Failed to insert cooking tools: ${toolsError.message}`,
      )
    }
  }

  return recipe
}

// Example usage with Deno
if (import.meta.main) {
  const { createClient } = await import("npm:@supabase/supabase-js")

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Load and insert your recipe
  const recipeData = JSON.parse(
    await Deno.readTextFile("./save-complete-recipe.json"),
  )

  const result = await insertRecipe(supabase, recipeData)
  console.log("Recipe inserted successfully:", result.id)
}
