/**
 * Recipe mutation functions (insert, update, delete)
 */

import type { Json, Supabase } from "../db/shared-client"
import type { Recipe } from "./queries"

export interface RecipeData {
  id: string
  title: string
  subtitle: string
  servings: number
  company_name: string | null
  cook_time_minutes: number
  cooking_tips: string | null
  ingredients: Array<{
    display_name: string
    quantity: number
    unit: string | null
    is_pantry_staple: boolean | null
    preparation_note: string | null
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
    display_name: string
  }>
  ocr_markdown: string
  ocr_results: Json
  pages: string[]
}

/**
 * Insert a complete recipe with all related data
 */
export async function insertRecipe(
  supabase: Supabase,
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
      cook_time_minutes: recipeData.cook_time_minutes,
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
      display_name: ing.display_name,
      quantity: ing.quantity,
      unit: ing.unit,
      is_pantry_staple: ing.is_pantry_staple,
      preparation_note: ing.preparation_note,
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
      display_name: tool.display_name,
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

/**
 * Upload a recipe from the getRecipe type (used for syncing between databases)
 * This function takes a complete recipe (as returned by getRecipe) and uploads it to the target database
 */
export async function uploadRecipe(
  supabase: Supabase,
  recipe: NonNullable<Recipe>,
) {
  // Insert the main recipe
  const { data: insertedRecipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      id: recipe.id,
      title: recipe.title,
      subtitle: recipe.subtitle,
      company_name: recipe.company_name,
      servings: recipe.servings,
      cook_time_minutes: recipe.cook_time_minutes,
      cooking_tips: recipe.cooking_tips,
      ocr_markdown: recipe.ocr_markdown,
      ocr_results: recipe.ocr_results,
      pages: recipe.pages,
    })
    .select()
    .single()

  if (recipeError) {
    throw new Error(`Failed to upload recipe: ${recipeError.message}`)
  }

  // Insert ingredients
  if (recipe.ingredients?.length > 0) {
    const ingredients = recipe.ingredients.map((ing) => ({
      recipe_id: insertedRecipe.id,
      display_name: ing.display_name,
      quantity: ing.quantity,
      unit: ing.unit,
      is_pantry_staple: ing.is_pantry_staple,
      preparation_note: ing.preparation_note,
      position: ing.position,
    }))

    const { error: ingredientsError } = await supabase
      .from("ingredients")
      .insert(ingredients)

    if (ingredientsError) {
      throw new Error(
        `Failed to upload ingredients: ${ingredientsError.message}`,
      )
    }
  }

  // Insert steps
  if (recipe.steps?.length > 0) {
    const steps = recipe.steps.map((step) => ({
      recipe_id: insertedRecipe.id,
      title: step.title,
      details: step.details,
      position: step.position,
    }))

    const { error: stepsError } = await supabase
      .from("steps")
      .insert(steps)

    if (stepsError) {
      throw new Error(`Failed to upload steps: ${stepsError.message}`)
    }
  }

  // Insert mise en place steps
  if (recipe.mise_en_place_steps?.length > 0) {
    const miseSteps = recipe.mise_en_place_steps.map((step) => ({
      recipe_id: insertedRecipe.id,
      title: step.title,
      details: step.details,
      position: step.position,
    }))

    const { error: miseError } = await supabase
      .from("mise_en_place_steps")
      .insert(miseSteps)

    if (miseError) {
      throw new Error(
        `Failed to upload mise en place steps: ${miseError.message}`,
      )
    }
  }

  // Insert cooking tools
  if (recipe.cooking_tools?.length > 0) {
    const tools = recipe.cooking_tools.map((tool) => ({
      recipe_id: insertedRecipe.id,
      display_name: tool.display_name,
      position: tool.position,
    }))

    const { error: toolsError } = await supabase
      .from("cooking_tools")
      .insert(tools)

    if (toolsError) {
      throw new Error(
        `Failed to upload cooking tools: ${toolsError.message}`,
      )
    }
  }

  return insertedRecipe
}
