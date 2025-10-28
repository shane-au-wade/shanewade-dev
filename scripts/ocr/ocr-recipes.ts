import { Mistral } from "@mistralai/mistralai"
import { encodeBase64 } from "@std/encoding/base64"
import { load } from "@std/dotenv"

const env = await load({
  // optional: choose a specific path (defaults to ".env")
  envPath: ".env",
  // optional: also export to the process environment (so Deno.env can read it)
  export: true,
})

const apiKey = env.MISTRAL_API_KEY ?? ""
if (!apiKey) {
  throw new Error("MISTRAL_API_KEY is not set")
}

const mistral = new Mistral({
  apiKey: apiKey,
})

async function encodeImage(imagePath: string) {
  const imageBuffer = await Deno.readFile(imagePath)
  const base64Image = encodeBase64(imageBuffer)
  return base64Image
}

const imagePath = "./local_data/recipes/Doxie 0062.png"
const base64Image = await encodeImage(imagePath)

const result = await mistral.ocr.process({
  model: "mistral-ocr-latest",
  document: {
    type: "image_url",
    imageUrl: "data:image/png;base64," + base64Image,
  },
  includeImageBase64: true,
})

// Replace image placeholders in markdown with base64-encoded images.
function replaceImagesInMarkdown(
  markdownStr: string,
  imagesDict: Record<string, string>,
): string {
  let result = markdownStr
  for (const [imgName, base64Str] of Object.entries(imagesDict)) {
    // Replace markdown image syntax ![imgName](imgName) with ![imgName](base64Str)
    // We try to match common image markdown patterns for the image id
    const imagePattern = new RegExp(
      `!\\[${imgName}\\]\\([^\\)]*${imgName}[^\\)]*\\)`,
      "g",
    )
    result = result.replace(
      imagePattern,
      `![${imgName}](${base64Str})`,
    )
  }
  return result
}

// Combine OCR text and images into a single markdown string
function getCombinedMarkdown(ocrResponse: any): string {
  const markdowns: string[] = []

  for (const page of ocrResponse.pages) {
    const imageData: Record<string, string> = {}
    if (page.images && Array.isArray(page.images)) {
      for (const img of page.images) {
        // Some OCR results may use camelCase or snake_case, try to support both
        const base64 = img.imageBase64 ?? img.image_base64 ??
          img.image_base64_data ?? ""
        if (base64 && img.id) {
          imageData[img.id] = base64
        }
      }
    }
    markdowns.push(replaceImagesInMarkdown(page.markdown, imageData))
  }

  return markdowns.join("\n\n")
}

const combinedMarkdown = getCombinedMarkdown(result)

Deno.writeTextFileSync("test-5.json", JSON.stringify(result, null, 2))
Deno.writeTextFileSync("test-5.md", result.pages[0].markdown)
Deno.writeTextFileSync("test-5-combined.md", combinedMarkdown)

console.log("OCR results saved to ocr-recipes.json")
