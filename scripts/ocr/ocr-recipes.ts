/**
 * Test OCR script using macOS Vision via Swift
 *
 * This script leverages the native macOS Vision API through a Swift script
 * for better OCR accuracy compared to Mistral OCR.
 */

import { resolve } from "@std/path"

/**
 * Performs OCR on an image using the macOS Vision API via Swift script
 */
async function performOCR(imagePath: string): Promise<string> {
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
  return ocrText.trim()
}

// Test with a sample image
const imagePath = "./local_data/Doxie 0121.png"

console.log(`Running OCR on: ${imagePath}`)
console.log("Using macOS Vision API via Swift...\n")

const startTime = Date.now()
const ocrText = await performOCR(imagePath)
const endTime = Date.now()

console.log(`OCR completed in ${endTime - startTime}ms`)
console.log(`Extracted ${ocrText.split("\n").length} lines of text\n`)

// Create a structured result object similar to Mistral's format for compatibility
const result = {
  method: "macos-vision",
  timestamp: new Date().toISOString(),
  imagePath: imagePath,
  processingTimeMs: endTime - startTime,
  text: ocrText,
  lineCount: ocrText.split("\n").length,
}

// Save results
Deno.writeTextFileSync("test.json", JSON.stringify(result, null, 2))
Deno.writeTextFileSync("test.txt", ocrText)

console.log("OCR results saved:")
console.log("  - test.json (structured data)")
console.log("  - test.txt (raw OCR text)")
console.log("\nPreview of extracted text:")
console.log("=".repeat(60))
console.log(ocrText.split("\n").slice(0, 20).join("\n"))
if (ocrText.split("\n").length > 20) {
  console.log(`\n... (${ocrText.split("\n").length - 20} more lines)`)
}
