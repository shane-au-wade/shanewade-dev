import recipeJson from "../../local_data/recipes-saved.json" with { type: "json" }
import { z } from "@zod/zod"
import * as deps from "../../repl-env.ts"
import { insertRecipe } from "../insert-recipe.ts"

const { mistral, openai, anthropic, supabase } = deps

const BATCH_OCR_RESULTS_JSONL_FILE_PATH = "./local_data/batch-ocr-results-recipes-1-to-25.jsonl"

const IMAGES_DIRECTORY = "./local_data/recipes"

type OcrPage = {
  index: number
  markdown: string
  images: Array<{
    id: string
    top_left_x: number
    top_left_y: number
    bottom_right_x: number
    bottom_right_y: number
    image_base64: string | null
    image_annotation: string | null
  }>
  dimensions: {
    dpi: number
    height: number
    width: number
  }
}

type OcrResult = {
  id: string
  custom_id: string
  response: {
    status_code: number
    body: {
      pages: OcrPage[]
      model: string
      usage_info: {
        pages_processed: number
        doc_size_bytes: number
      }
      document_annotation: null | string
    }
  }
  error: null | string
}

type Recipe = {
  id: string
  pages: string[]
}

type RecipeWithOcr = Recipe & {
  ocr_results: Array<{
    page: string
    markdown: string
    ocr_data: OcrPage
  }>
  ocr_markdown: string
}

// Load JSONL file and parse each line
async function loadJsonl(filePath: string): Promise<OcrResult[]> {
  const text = await Deno.readTextFile(filePath)
  const lines = text.trim().split("\n")
  return lines.map((line) => JSON.parse(line))
}

// Parse custom_id to extract recipe ID and page filename
function parseCustomId(customId: string): { recipeId: string; pageName: string } {
  // Format: {recipeId}-doxie-{page_number}
  // Example: "2373ab9a-fb1c-47e8-b3a5-89a916065b5a-doxie-0311"
  const parts = customId.split("-")

  // Recipe ID is the first 5 parts (UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const recipeId = parts.slice(0, 5).join("-")

  // Page name is the last two parts: "doxie-0311" -> "Doxie 0311.png"
  const pageNumber = parts[parts.length - 1]
  const pageName = `Doxie ${pageNumber}.png`

  return { recipeId, pageName }
}

// Main function to combine recipes with their OCR results
async function combineRecipesWithOcr(): Promise<RecipeWithOcr[]> {
  // Load recipes
  const recipes = recipeJson as Recipe[]

  // Load OCR results
  const ocrResults = await loadJsonl(BATCH_OCR_RESULTS_JSONL_FILE_PATH)

  // Create a map of recipe ID + page name to OCR result
  const ocrMap = new Map<string, OcrResult>()

  for (const ocrResult of ocrResults) {
    const { recipeId, pageName } = parseCustomId(ocrResult.custom_id)
    const key = `${recipeId}:${pageName}`
    ocrMap.set(key, ocrResult)
  }

  // Combine recipes with their OCR results
  const recipesWithOcr: RecipeWithOcr[] = recipes.map((recipe) => {
    const ocr_results = recipe.pages.map((page) => {
      const key = `${recipe.id}:${page}`
      const ocrResult = ocrMap.get(key)

      if (!ocrResult) {
        console.warn(`No OCR result found for recipe ${recipe.id}, page ${page}`)
        return {
          page,
          markdown: "",
          ocr_data: {} as OcrPage,
        }
      }

      // Extract the first page from the OCR result (should only be one page per result)
      const ocrPage = ocrResult.response.body.pages[0]

      return {
        page,
        markdown: ocrPage.markdown,
        ocr_data: ocrPage,
      }
    })

    return {
      ...recipe,
      ocr_markdown: ocr_results.map((ocr) => ocr.markdown).join("\n\n"),
      // all of the ocr results for each page of the recipe
      ocr_results,
    }
  })

  return recipesWithOcr
}

const ingredientSchema = z.object({
  type: z.literal("ingredient"),
  display_name: z.string(),
  quantity: z.number(),
  unit: z.string().nullable(),
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
  servings: z.string(),
  company_name: z.string().nullable(),
  cook_time: z.string(),
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
      { role: "system", content: "Extract the recipe ingredients when given recipe text." },
      {
        role: "user",
        content: recipe.ocr_markdown,
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
`.trim(),
      },
      {
        role: "user",
        content: recipe.ocr_markdown,
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
`.trim(),
      },
      {
        role: "user",
        content: recipe.ocr_markdown,
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
        content: recipe.ocr_markdown,
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
        content: recipe.ocr_markdown,
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
  const recipesWithOcr = await combineRecipesWithOcr()

  // await Deno.writeTextFile("./save.json", JSON.stringify(recipesWithOcr, null, 2))

  console.log(`Loaded ${recipesWithOcr.length} recipes`)

  // I see the case for 3 extraction steps

  // 1. ingredients
  // 2. recipe steps
  // 3. general recipe fields like title, description, etc

  const firstRecipe = recipesWithOcr[0]
  const recipeInfoResult = await extractRecipeInfoOpenai(firstRecipe)
  const ingredientsResult = await extractIngredientsOpenai(firstRecipe)
  const stepsResult = await extractStepsOpenai(firstRecipe)
  const miseEnPlaceStepsResult = await extractMiseEnPlaceStepsOpenai(firstRecipe)
  const cookingToolsResult = await extractCookingToolsOpenai(firstRecipe)

  if (
    !(recipeInfoResult.type === "success" && ingredientsResult.type === "success" && stepsResult.type === "success" &&
      miseEnPlaceStepsResult.type === "success" && cookingToolsResult.type === "success")
  ) {
    console.error("one or more extraction steps failed")
    Deno.exit(1)
  }

  const completeRecipe = {
    id: firstRecipe.id,
    ...recipeInfoResult.result,
    ...ingredientsResult.result,
    ...stepsResult.result,
    ...miseEnPlaceStepsResult.result,
    ...cookingToolsResult.result,
    ocr_markdown: firstRecipe.ocr_markdown,
    ocr_results: firstRecipe.ocr_results,
    pages: firstRecipe.pages,
  }

  // insert the complete recipe into the database
  await insertRecipe(supabase, completeRecipe)

  // await Deno.writeTextFile(
  //   "./save-complete-recipe.json",
  //   JSON.stringify(completeRecipe, null, 2),
  // )
}
