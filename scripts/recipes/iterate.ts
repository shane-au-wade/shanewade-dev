import { z } from "@zod/zod"
import { openai, supabase } from "../../repl-env.ts"
import { getRecipe } from "@shared/core/recipes/queries"
import { getLatestIteration, insertIteration, type IterativeRecipeData } from "@shared/core/recipes/iterations"

const iterativeRecipeSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  servings: z.number(),
  company_name: z.string().nullable(),
  cook_time_minutes: z.number(),
  cooking_tips: z.string().nullable(),
  ingredients: z.array(z.object({
    display_name: z.string(),
    quantity: z.number(),
    unit: z.string().nullable(),
    is_pantry_staple: z.boolean().nullable(),
    preparation_note: z.string().nullable(),
    position: z.number(),
  })),
  steps: z.array(z.object({
    title: z.string(),
    details: z.string(),
    position: z.number(),
  })),
  mise_en_place_steps: z.array(z.object({
    title: z.string(),
    details: z.string(),
    position: z.number(),
  })),
  cooking_tools: z.array(z.object({
    display_name: z.string(),
    position: z.number(),
  })),
})

function recipeToIterativeData(recipe: NonNullable<Awaited<ReturnType<typeof getRecipe>>>): IterativeRecipeData {
  return {
    title: recipe.title,
    subtitle: recipe.subtitle ?? "",
    servings: recipe.servings ?? 0,
    company_name: recipe.company_name,
    cook_time_minutes: recipe.cook_time_minutes ?? 0,
    cooking_tips: recipe.cooking_tips,
    ingredients: recipe.ingredients.map((ing, i) => ({
      display_name: ing.display_name,
      quantity: ing.quantity ?? 0,
      unit: ing.unit,
      is_pantry_staple: ing.is_pantry_staple,
      preparation_note: ing.preparation_note,
      position: ing.position ?? i,
    })),
    steps: recipe.steps.map((s, i) => ({
      title: s.title,
      details: s.details,
      position: s.position ?? i,
    })),
    mise_en_place_steps: recipe.mise_en_place_steps.map((s, i) => ({
      title: s.title,
      details: s.details,
      position: s.position ?? i,
    })),
    cooking_tools: recipe.cooking_tools.map((t, i) => ({
      display_name: t.display_name,
      position: t.position ?? i,
    })),
  }
}

async function iterate(recipeId: string, prompt: string) {
  console.log(`\nFetching recipe ${recipeId}...`)

  const recipe = await getRecipe(supabase, recipeId)
  if (!recipe) {
    console.error(`Recipe not found: ${recipeId}`)
    Deno.exit(1)
  }

  console.log(`Recipe: ${recipe.title}`)

  const latestIteration = await getLatestIteration(supabase, recipeId)
  const currentState: IterativeRecipeData = latestIteration
    ? latestIteration.recipe_data as unknown as IterativeRecipeData
    : recipeToIterativeData(recipe)

  const version = latestIteration ? latestIteration.version : 0
  console.log(`Current version: ${version === 0 ? "original" : `v${version}`}`)
  console.log(`Prompt: "${prompt}"`)
  console.log(`\nCalling OpenAI...`)

  const response = await openai.responses.create({
    model: "gpt-4.1-2025-04-14",
    input: [
      {
        role: "system",
        content:
          `You are a recipe editor. You will receive a recipe as JSON and a user instruction describing how to modify it.

Return the COMPLETE modified recipe. Apply ONLY the changes the user requests. Preserve everything else exactly as-is (all fields, positions, formatting, HTML tags in step details, etc.).

Rules:
- Keep ingredient display_name in Title Case
- Keep units normalized (oz, lb, g, kg, cup, tbsp, tsp, ml, l, whole, slice, clove, pinch, dash, fl oz)
- Maintain position ordering (0-indexed, sequential)
- Preserve <b> tags in step details for ingredients/quantities
- If adding new steps or ingredients, assign appropriate positions
- cooking_tips should be updated if the modification affects cooking technique`,
      },
      {
        role: "user",
        content: `Here is the current recipe:\n\n${
          JSON.stringify(currentState, null, 2)
        }\n\nModification requested: ${prompt}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "iterative_recipe",
        description: "The complete modified recipe.",
        schema: z.toJSONSchema(iterativeRecipeSchema),
        strict: true,
      },
    },
  })

  if (!response.output_text) {
    console.error("No output from OpenAI")
    Deno.exit(1)
  }

  const json = JSON.parse(response.output_text)
  const parseResult = iterativeRecipeSchema.safeParse(json)

  if (!parseResult.success) {
    console.error("Failed to parse OpenAI response:", parseResult.error.message)
    Deno.exit(1)
  }

  const newRecipeData = parseResult.data as IterativeRecipeData

  const iteration = await insertIteration(supabase, recipeId, prompt, newRecipeData)

  console.log(`\nIteration v${iteration.version} saved!`)
  console.log(`Title: ${newRecipeData.title}`)
  console.log(`Ingredients: ${newRecipeData.ingredients.length}`)
  console.log(`Steps: ${newRecipeData.steps.length}`)
  console.log(`Mise en place: ${newRecipeData.mise_en_place_steps.length}`)
  console.log(`Tools: ${newRecipeData.cooking_tools.length}`)
}

if (import.meta.main) {
  const [recipeId, ...promptParts] = Deno.args

  if (!recipeId || promptParts.length === 0) {
    console.error("Usage: deno run -A scripts/recipes/iterate.ts <recipe_id> <prompt>")
    console.error('Example: deno run -A scripts/recipes/iterate.ts 79f54da8-... "Make this vegetarian"')
    Deno.exit(1)
  }

  const prompt = promptParts.join(" ")
  await iterate(recipeId, prompt)
}
