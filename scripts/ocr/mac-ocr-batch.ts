/**
 * Batch OCR processing using macOS Vision via Swift
 *
 * This script processes multiple recipe images using the native macOS Vision API
 * for better OCR accuracy. Each recipe consists of 2 pages/images.
 */

import { resolve } from "@std/path"

type Recipe = {
  id: string
  pages: string[]
  name?: string
  ocrResults?: PageOCRResult[]
}

type PageOCRResult = {
  pageName: string
  text: string
  lineCount: number
  processingTimeMs: number
  error?: string
}

/**
 * Performs OCR on an image using the macOS Vision API via Swift script
 */
async function performOCR(imagePath: string): Promise<{
  text: string
  processingTimeMs: number
}> {
  const startTime = Date.now()
  const resolvedImagePath = resolve(imagePath)
  const macOcrScriptPath = resolve("./mac-ocr")

  // Check if the Swift OCR script exists
  try {
    await Deno.stat(macOcrScriptPath)
  } catch {
    throw new Error(
      `Swift OCR script not found at ${macOcrScriptPath}. Please ensure mac-ocr is in the project root.`,
    )
  }

  // Check if the image exists
  try {
    await Deno.stat(resolvedImagePath)
  } catch {
    throw new Error(`Image not found at ${resolvedImagePath}`)
  }

  // Make sure the Swift script is executable
  await Deno.chmod(macOcrScriptPath, 0o755)

  // Execute the Swift OCR script
  const command = new Deno.Command(macOcrScriptPath, {
    args: [resolvedImagePath],
    stdout: "piped",
    stderr: "piped",
  })

  const { code, stdout, stderr } = await command.output()

  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr)
    throw new Error(`OCR failed: ${errorText}`)
  }

  const ocrText = new TextDecoder().decode(stdout)
  const processingTimeMs = Date.now() - startTime

  return {
    text: ocrText.trim(),
    processingTimeMs,
  }
}

// Recipe directory and helper function
const recipeDirectory = "./local_data/recipes"
function getImagePath(imageName: string) {
  return `${recipeDirectory}/${imageName}`
}

// List all of the images in the recipe directory
// Ensure that the images are sorted by name
console.log(`Loading images from: ${recipeDirectory}`)
const images = Array.from(Deno.readDirSync(recipeDirectory))
  .filter((entry) =>
    entry.isFile && (entry.name.endsWith(".png") || entry.name.endsWith(".jpg") || entry.name.endsWith(".jpeg"))
  )
  .sort((a, b) => a.name.localeCompare(b.name))

console.log(`Found ${images.length} images`)

const recipes: Recipe[] = []

// Each recipe consists of 2 images
// Loop over the images and process them into recipes
for (let i = 0; i < images.length; i += 2) {
  const image1 = images[i]
  const image2 = images[i + 1]

  if (!image2) {
    console.warn(`Warning: Odd number of images. Skipping last image: ${image1.name}`)
    break
  }

  const recipe: Recipe = {
    id: crypto.randomUUID(),
    pages: [image1.name, image2.name],
  }
  recipes.push(recipe)
}

console.log(`Created ${recipes.length} recipes (${recipes.length * 2} pages total)`)
console.log("\nStarting OCR processing...\n")

// Process each recipe
const startTime = Date.now()
let processedPages = 0
let failedPages = 0

for (const [recipeIndex, recipe] of recipes.entries()) {
  console.log(`\n[${recipeIndex + 1}/${recipes.length}] Processing recipe ${recipe.id}`)
  recipe.ocrResults = []

  for (const [pageIndex, pageName] of recipe.pages.entries()) {
    const pageNumber = pageIndex + 1
    const imagePath = getImagePath(pageName)

    try {
      console.log(`  Page ${pageNumber}: ${pageName}...`)
      const result = await performOCR(imagePath)

      const ocrResult: PageOCRResult = {
        pageName,
        text: result.text,
        lineCount: result.text.split("\n").length,
        processingTimeMs: result.processingTimeMs,
      }

      recipe.ocrResults.push(ocrResult)
      processedPages++

      console.log(
        `    ✓ Completed in ${result.processingTimeMs}ms (${ocrResult.lineCount} lines)`,
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`    ✗ Failed: ${errorMessage}`)

      recipe.ocrResults.push({
        pageName,
        text: "",
        lineCount: 0,
        processingTimeMs: 0,
        error: errorMessage,
      })
      failedPages++
    }
  }

  // Extract recipe name from first page (usually in the first few lines)
  if (recipe.ocrResults[0]?.text) {
    const firstLines = recipe.ocrResults[0].text.split("\n").slice(0, 15)
    // Look for a line that looks like a title (all caps or title case, not too short)
    const titleLine = firstLines.find((line) =>
      line.length > 5 &&
      line.length < 60 &&
      (line === line.toUpperCase() || /^[A-Z][a-zA-Z\s&-]+$/.test(line))
    )
    if (titleLine) {
      recipe.name = titleLine.trim()
    }
  }
}

const totalTime = Date.now() - startTime
const avgTimePerPage = processedPages > 0 ? totalTime / processedPages : 0

// Save results
const outputPath = "./local_data/mac-ocr-batch-results.json"
Deno.writeTextFileSync(
  outputPath,
  JSON.stringify(
    {
      metadata: {
        processedAt: new Date().toISOString(),
        totalRecipes: recipes.length,
        totalPages: recipes.length * 2,
        processedPages,
        failedPages,
        totalProcessingTimeMs: totalTime,
        avgTimePerPageMs: Math.round(avgTimePerPage),
      },
      recipes,
    },
    null,
    2,
  ),
)

// Also save a summary file with just the text
const summaryPath = "./local_data/mac-ocr-batch-summary.txt"
const summaryLines: string[] = []
summaryLines.push("=".repeat(80))
summaryLines.push("BATCH OCR RESULTS SUMMARY")
summaryLines.push("=".repeat(80))
summaryLines.push("")

for (const [index, recipe] of recipes.entries()) {
  summaryLines.push(`\nRecipe ${index + 1}: ${recipe.name || "Unnamed"}`)
  summaryLines.push(`ID: ${recipe.id}`)
  summaryLines.push("-".repeat(80))

  for (const result of recipe.ocrResults || []) {
    summaryLines.push(`\nPage: ${result.pageName}`)
    if (result.error) {
      summaryLines.push(`ERROR: ${result.error}`)
    } else {
      summaryLines.push(`Lines: ${result.lineCount}, Time: ${result.processingTimeMs}ms`)
      summaryLines.push("")
      summaryLines.push(result.text)
    }
    summaryLines.push("")
  }
}

Deno.writeTextFileSync(summaryPath, summaryLines.join("\n"))

// Print final summary
console.log("\n" + "=".repeat(80))
console.log("BATCH OCR COMPLETE")
console.log("=".repeat(80))
console.log(`Total recipes:        ${recipes.length}`)
console.log(`Total pages:          ${recipes.length * 2}`)
console.log(`Successfully processed: ${processedPages}`)
console.log(`Failed:               ${failedPages}`)
console.log(`Total time:           ${(totalTime / 1000).toFixed(2)}s`)
console.log(`Avg time per page:    ${Math.round(avgTimePerPage)}ms`)
console.log(`\nResults saved to:`)
console.log(`  - ${outputPath} (structured JSON)`)
console.log(`  - ${summaryPath} (text summary)`)
