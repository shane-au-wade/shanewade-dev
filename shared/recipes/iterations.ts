import type { Json, Supabase } from "../db/client.ts"

export interface IterativeRecipeData {
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
    position: number
  }>
  steps: Array<{
    title: string
    details: string
    position: number
  }>
  mise_en_place_steps: Array<{
    title: string
    details: string
    position: number
  }>
  cooking_tools: Array<{
    display_name: string
    position: number
  }>
}

export async function getLatestIteration(supabase: Supabase, recipeId: string) {
  const { data, error } = await supabase
    .from("recipe_iterations")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch latest iteration: ${error.message}`)
  }

  return data
}

export async function getIterationHistory(supabase: Supabase, recipeId: string) {
  const { data, error } = await supabase
    .from("recipe_iterations")
    .select("id, version, prompt, created_at")
    .eq("recipe_id", recipeId)
    .order("version", { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch iteration history: ${error.message}`)
  }

  return data
}

export async function insertIteration(
  supabase: Supabase,
  recipeId: string,
  prompt: string,
  recipeData: IterativeRecipeData,
) {
  const latest = await getLatestIteration(supabase, recipeId)
  const nextVersion = latest ? latest.version + 1 : 1

  const { data, error } = await supabase
    .from("recipe_iterations")
    .insert({
      recipe_id: recipeId,
      version: nextVersion,
      prompt,
      recipe_data: recipeData as unknown as Json,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to insert iteration: ${error.message}`)
  }

  return data
}
