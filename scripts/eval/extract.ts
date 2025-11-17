import { z } from "@zod/zod"
import * as deps from "../../repl-env.ts"
import { delay } from "@std/async/delay"
import { insertRecipe } from "@shared/core/recipes/mutations"

const { openai, supabase } = deps

const MAC_OCR_BATCH_RESULTS_FILE_PATH = "./local_data/mac-ocr-batch-results.json"

const PROCESSING_CACHE_FILE_PATH = "./local_data/processing-cache.json"

async function loadProcessingCache(): Promise<Record<string, boolean>> {
  try {
    const stats = await Deno.lstat(PROCESSING_CACHE_FILE_PATH)

    if (!stats.isFile) {
      await Deno.writeTextFile(PROCESSING_CACHE_FILE_PATH, "{}")
    }

    const text = await Deno.readTextFile(PROCESSING_CACHE_FILE_PATH)
    return JSON.parse(text)
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err
    }
    console.log("File does not exist")
    await Deno.writeTextFile(PROCESSING_CACHE_FILE_PATH, "{}")
    return {}
  }
}

type MacOcrPageResult = {
  pageName: string
  text: string
  lineCount: number
  processingTimeMs: number
}

type MacOcrRecipe = {
  id: string
  pages: string[]
  ocrResults: MacOcrPageResult[]
  name: string
}

type MacOcrBatchResults = {
  metadata: {
    processedAt: string
    totalRecipes: number
    totalPages: number
    processedPages: number
    failedPages: number
    totalProcessingTimeMs: number
    avgTimePerPageMs: number
  }
  recipes: MacOcrRecipe[]
}

type RecipeWithOcr = {
  id: string
  pages: string[]
  name: string
  ocr_results: Array<{
    page: string
    text: string
  }>
  ocr_text: string
}

// Load Mac OCR batch results from JSON file
async function loadMacOcrBatchResults(filePath: string): Promise<MacOcrBatchResults> {
  const text = await Deno.readTextFile(filePath)
  return JSON.parse(text)
}

// Main function to load recipes with their OCR results from Mac OCR format
async function loadRecipesWithOcr(): Promise<RecipeWithOcr[]> {
  // Load OCR results
  const batchResults = await loadMacOcrBatchResults(MAC_OCR_BATCH_RESULTS_FILE_PATH)

  // Convert Mac OCR recipes to RecipeWithOcr format
  const recipesWithOcr: RecipeWithOcr[] = batchResults.recipes.map((recipe) => {
    const ocr_results = recipe.ocrResults.map((ocrResult) => ({
      page: ocrResult.pageName,
      text: ocrResult.text,
    }))

    return {
      id: recipe.id,
      pages: recipe.pages,
      name: recipe.name,
      ocr_results,
      ocr_text: ocr_results.map((ocr) => ocr.text).join("\n\n"),
    }
  })

  return recipesWithOcr
}

const ingredientSchema = z.object({
  type: z.literal("ingredient"),
  display_name: z.string().describe(
    "The ingredient name in Title Case, without brand names or customization options in parentheses. E.g., 'Ground Pork' not 'Ground Pork (or Ground Beef...)'",
  ),
  quantity: z.number().describe(
    "The numeric quantity. Use 0 for 'as needed' or pantry items with no specific quantity.",
  ),
  unit: z.enum([
    "oz",
    "lb",
    "g",
    "kg", // Weight
    "cup",
    "tbsp",
    "tsp",
    "ml",
    "l", // Volume
    "whole",
    "slice",
    "clove", // Count-based
    "pinch",
    "dash", // Approximate
    "fl oz", // Fluid ounces
  ]).nullable().describe(
    "The unit of measurement, normalized (no periods). Use 'whole' for counted items like eggs, onions. Use null only if truly ambiguous.",
  ),
  is_pantry_staple: z.boolean().nullable().describe(
    "True for common pantry items like salt, pepper, oil, water that should show 'as needed'. Defaults to false.",
  ),
  preparation_note: z.string().nullable().describe(
    "Any preparation specified in the ingredient list, e.g., 'diced', 'minced', 'cooked'. Keep null if none.",
  ),
})

const ingredientsSchema = z.object({
  ingredients: z.array(ingredientSchema),
})

const stepSchema = z.object({
  type: z.literal("step"),
  title: z.string(),
  details: z.string(),
})

const stepsSchema = z.object({
  steps: z.array(stepSchema),
})

const miseEnPlaceStepsSchema = z.object({
  mise_en_place_steps: z.array(stepSchema),
})

const recipeInfoSchema = z.object({
  type: z.literal("recipe"),
  title: z.string(),
  subtitle: z.string(),
  servings: z.number().describe("The lowest reported number of servings the recipe yeilds. Usually 2 or 4 servings."),
  company_name: z.string().nullable(),
  cook_time_minutes: z.number().describe("The number of minutes the recipe takes to cook."),
  cooking_tips: z.string().nullable(),
})

const cookingToolSchema = z.object({
  type: z.literal("cooking_tool"),
  display_name: z.string(),
})

const cookingToolsSchema = z.object({
  cooking_tools: z.array(cookingToolSchema),
})

type Ingredient = z.input<typeof ingredientSchema>
type Ingredients = z.input<typeof ingredientsSchema>

type Step = z.input<typeof stepSchema>
type Steps = z.input<typeof stepsSchema>

type MiseEnPlace = z.input<typeof miseEnPlaceStepsSchema>

type CookingTool = z.input<typeof cookingToolSchema>
type CookingTools = z.input<typeof cookingToolsSchema>

type RecipeInfo = z.input<typeof recipeInfoSchema>

type ExtractionSuccess<T> = {
  type: "success"
  result: T
}
type ExtractionError<T> = {
  type: "error"
  result: unknown
  error: string
}

type ExtractionResult<T> = ExtractionSuccess<T> | ExtractionError<T>

async function extractIngredientsOpenai(
  recipe: RecipeWithOcr,
): Promise<ExtractionResult<Ingredients>> {
  const response = await openai.responses.create({
    model: "gpt-4.1-2025-04-14",
    input: [
      {
        role: "system",
        content: `Context about the input recipes and the goal of the extraction:
The recipes are from meal kit companies like Blue Apron, Hello Fresh, etc.
The meal kit company typically provides most of the ingredients for the recipe and the 
buyer provides the pantry basics like salt, pepper, oil, etc.  The goal of this extraction is to
create a recipe that a buyer can follow to make the recipe without the meal kit company's ingredients.
        
Extract recipe ingredients with proper normalization:

INGREDIENT NAMES:
- Use Title Case (e.g., "Sour Cream" not "sour cream")
- Remove brand names and parenthetical options (e.g., "Ground Pork" not "Ground Pork (or Ground Beef...)")
- Use singular or plural as naturally appropriate (e.g., "Flour Tortillas" for multiple, "Tomato" for one)
- Keep specific types when important (e.g., "Pepperjack Cheese Slices" vs just "Cheese")

UNITS:
- Normalize all units: "oz" not "oz.", "tbsp" not "Tbsp." or "tablespoon"
- Use "whole" for counted items (eggs, onions, scallions, etc.)
- Use "fl oz" for fluid ounces (liquids sold by volume)
- Convert fractions to decimals (e.g., "1/4" → 0.25, "1 1/2" → 1.5)

PANTRY STAPLES:
- Mark these as is_pantry_staple=true: salt, pepper, cooking oil, olive oil, water, cooking spray
- Use quantity=0 for items listed as "as needed" or with no specific amount

PREPARATION NOTES:
- Extract any prep mentioned with the ingredient (e.g., "diced", "minced", "peeled")
- Keep in preparation_note field, not in display_name

Extract ingredients from the smallest serving size mentioned (usually "2 servings" column).`,
      },
      {
        role: "user",
        content: recipe.ocr_text,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "recipe_ingredients",
        description: "The ingredients of the recipe.",
        schema: z.toJSONSchema(ingredientsSchema),
        strict: true,
      },
    },
  })

  if (!response.output_text) {
    return {
      type: "error",
      result: response.output_text,
      error: "No output parsed",
    }
  }

  const json = JSON.parse(response.output_text)
  const parseResult = ingredientsSchema.safeParse(json)

  if (!parseResult.success) {
    return {
      type: "error",
      result: json.result,
      error: parseResult.error.message,
    }
  }

  return {
    type: "success",
    result: parseResult.data,
  }
}

async function extractStepsOpenai(recipe: RecipeWithOcr): Promise<ExtractionResult<Steps>> {
  const response = await openai.responses.create({
    model: "gpt-4.1-2025-04-14",
    input: [
      {
        role: "system",
        content: `
Extract the recipe steps when given recipe text.
The steps should be in the order they are to be followed.

Please highlight the ingredients and quantities in the text with the standard html <b> tag.
For example, if celery is an ingredient and the text is "Add celery to the pot", the output should be "Add <b>celery</b> to the pot".
Another example, if the text is "Add 1/2 cup of celery to the pot", the output should be "Add <b>1/2 cup</b> of <b>celery</b> to the pot".
`.trim(),
      },
      {
        role: "user",
        content: recipe.ocr_text,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "steps",
        description: "The steps of the recipe in the order they are to be followed.",
        schema: z.toJSONSchema(stepsSchema),
        strict: true,
      },
    },
  })

  if (!response.output_text) {
    return {
      type: "error",
      result: response.output_text,
      error: "No output parsed",
    }
  }
  const json = JSON.parse(response.output_text)
  const parseResult = stepsSchema.safeParse(json)

  if (!parseResult.success) {
    return {
      type: "error",
      result: json.result,
      error: parseResult.error.message,
    }
  }

  return {
    type: "success",
    result: parseResult.data,
  }
}

async function extractMiseEnPlaceStepsOpenai(recipe: RecipeWithOcr): Promise<ExtractionResult<MiseEnPlace>> {
  const response = await openai.responses.create({
    model: "gpt-4.1-2025-04-14",
    input: [
      {
        role: "system",
        content: `
Extract the mise en place (set up) steps for the given recipe by reading each 
step of the recipe and pulling out the work that can be done ahead of time.
This will be things like chopping vegetables, getting out a mixing bowl, etc.
The goal is to reduce the amount of work that neeeds to be done while cooking.
Keep the steps concise and tend towards less steps, for example the title coule be "Chop vegetables" and the details
would describe the specific preperation for each vegetable.

Please highlight the ingredients and quantities in the text with the standard html <b> tag.
For example, if celery is an ingredient and the text is "Add celery to the pot", the output should be "Add <b>celery</b> to the pot".
Another example, if the text is "Add 1/2 cup of celery to the pot", the output should be "Add <b>1/2 cup</b> of <b>celery</b> to the pot".
`.trim(),
      },
      {
        role: "user",
        content: recipe.ocr_text,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "steps",
        description: "The mise end place steps of the recipe.",
        schema: z.toJSONSchema(miseEnPlaceStepsSchema),
        strict: true,
      },
    },
  })

  if (!response.output_text) {
    return {
      type: "error",
      result: response.output_text,
      error: "No output parsed",
    }
  }
  const json = JSON.parse(response.output_text)
  const parseResult = miseEnPlaceStepsSchema.safeParse(json)

  if (!parseResult.success) {
    return {
      type: "error",
      result: json.result,
      error: parseResult.error.message,
    }
  }

  return {
    type: "success",
    result: parseResult.data,
  }
}

async function extractCookingToolsOpenai(
  recipe: RecipeWithOcr,
): Promise<ExtractionResult<CookingTools>> {
  // ingredients extraction
  const response = await openai.responses.create({
    model: "gpt-4.1-2025-04-14",
    input: [
      { role: "system", content: "Extract the cooking tools used in the recipe." },
      {
        role: "user",
        content: recipe.ocr_text,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "cooking_tools",
        description: "The cooking tools used in the recipe.",
        schema: z.toJSONSchema(cookingToolsSchema),
        strict: true,
      },
    },
  })

  if (!response.output_text) {
    return {
      type: "error",
      result: response.output_text,
      error: "No output parsed",
    }
  }

  const json = JSON.parse(response.output_text)
  const parseResult = cookingToolsSchema.safeParse(json)

  if (!parseResult.success) {
    return {
      type: "error",
      result: json.result,
      error: parseResult.error.message,
    }
  }

  return {
    type: "success",
    result: parseResult.data,
  }
}

async function extractRecipeInfoOpenai(
  recipe: RecipeWithOcr,
): Promise<ExtractionResult<RecipeInfo>> {
  // ingredients extraction
  const response = await openai.responses.create({
    model: "gpt-4.1-2025-04-14",
    input: [
      { role: "system", content: "Extract the recipe information." },
      {
        role: "user",
        content: recipe.ocr_text,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "recipe_info",
        description: "The information of the recipe.",
        schema: z.toJSONSchema(recipeInfoSchema),
        strict: true,
      },
    },
  })

  if (!response.output_text) {
    return {
      type: "error",
      result: response.output_text,
      error: "No output parsed",
    }
  }

  const json = JSON.parse(response.output_text)
  const parseResult = recipeInfoSchema.safeParse(json)

  if (!parseResult.success) {
    return {
      type: "error",
      result: json.result,
      error: parseResult.error.message,
    }
  }

  return {
    type: "success",
    result: parseResult.data,
  }
}

// Run the script
if (import.meta.main) {
  const recipesWithOcr = await loadRecipesWithOcr()

  const processingCache = await loadProcessingCache()
  // await Deno.writeTextFile("./save.json", JSON.stringify(recipesWithOcr, null, 2))

  console.log(`Loaded ${recipesWithOcr.length} recipes`)

  // test with only one recipe
  for (const recipe of recipesWithOcr) {
    if (processingCache[recipe.id]) {
      console.log(`Skipping recipe ${recipe.id} because it is already being processed`)
      continue
    }

    console.log(`[INFO] Processing recipe ${recipe.id} (${recipe.name})`)

    // extract the recipe in parallel
    const [recipeInfoResult, ingredientsResult, stepsResult, miseEnPlaceStepsResult, cookingToolsResult] = await Promise
      .all([
        extractRecipeInfoOpenai(recipe),
        extractIngredientsOpenai(recipe),
        extractStepsOpenai(recipe),
        extractMiseEnPlaceStepsOpenai(recipe),
        extractCookingToolsOpenai(recipe),
      ])

    if (
      !(recipeInfoResult.type === "success" && ingredientsResult.type === "success" && stepsResult.type === "success" &&
        miseEnPlaceStepsResult.type === "success" && cookingToolsResult.type === "success")
    ) {
      console.error("one or more extraction steps failed")
      continue
    }

    const completeRecipe = {
      id: recipe.id,
      ...recipeInfoResult.result,
      ...ingredientsResult.result,
      ...stepsResult.result,
      ...miseEnPlaceStepsResult.result,
      ...cookingToolsResult.result,
      ocr_markdown: recipe.ocr_text, // Map ocr_text to ocr_markdown for database compatibility
      ocr_results: recipe.ocr_results,
      pages: recipe.pages,
    }

    // Deno.writeTextFileSync("./save-complete-recipe.json", JSON.stringify(completeRecipe, null, 2))

    try {
      // insert the complete recipe into the database
      await insertRecipe(supabase, completeRecipe)

      processingCache[recipe.id] = true
      await Deno.writeTextFile(PROCESSING_CACHE_FILE_PATH, JSON.stringify(processingCache))
    } catch (error) {
      console.error("failed to insert recipe", error)
    }

    // sleep for 1 second to avoid rate limiting
    await delay(1000)
  }
}
