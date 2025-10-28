import { Mistral } from "@mistralai/mistralai"
import { encodeBase64 } from "@std/encoding/base64"
import { load } from "@std/dotenv"

const env = await load({
  envPath: ".env",
  export: true,
})

const apiKey = env.MISTRAL_API_KEY ?? ""
if (!apiKey) {
  throw new Error("MISTRAL_API_KEY is not set")
}

let mistral = new Mistral({ apiKey: env.MISTRAL_API_KEY })

async function createBatch(batchFile: string) {
  const file = await mistral.files.upload({
    file: {
      fileName: batchFile,
      content: Deno.readFileSync(batchFile),
    },
    purpose: "batch",
  })

  const job = await mistral.batch.jobs.create({
    inputFiles: [file.id],
    model: "mistral-ocr-latest",
    endpoint: "/v1/ocr",
    metadata: { description: "recipe ocr batch", batch_id: batchFile },
  })

  return job.id
}

async function createJob(fileId: string) {
  const job = await mistral.batch.jobs.create({
    inputFiles: [fileId],
    model: "mistral-ocr-latest",
    endpoint: "/v1/ocr",
    metadata: { description: "recipe ocr batch", batch_id: "recipes-1.jsonl" },
  })
  return job.id
}

async function encodeImage(imagePath: string) {
  const imageBuffer = await Deno.readFile(imagePath)
  const base64Image = encodeBase64(imageBuffer)
  return base64Image
}

const recipeDirectory = "./local_data/recipes"
function getImagePath(imageName: string) {
  return `${recipeDirectory}/${imageName}`
}

// list all of the images in the recipe directory
// ensure that the images are sorted by name
const images = Array.from(Deno.readDirSync(recipeDirectory)).sort((a, b) => a.name.localeCompare(b.name))
const recipes: Recipe[] = []

type Recipe = {
  id: string
  pages: string[]
  name?: string
  markdown?: string
}

// each recipe consists of 2 png images
// loop over the images and process them into recipes which consist
for (let i = 0; i < images.length; i += 2) {
  const image1 = images[i]
  const image2 = images[i + 1]
  const recipe: Recipe = {
    id: crypto.randomUUID(),
    pages: [image1.name, image2.name],
  }
  recipes.push(recipe)
}

Deno.writeTextFileSync(
  "scripts/recipes.json",
  JSON.stringify(recipes, null, 2),
)

// create batches of size 10 due to large image sizes
const batchSize = 5
const batches = []
for (let i = 0; i < recipes.length; i += batchSize) {
  batches.push(recipes.slice(i, i + batchSize))
}

for (const [index, batch] of batches.entries()) {
  console.log(`Processing batch ${index + 1} of ${batches.length}`)

  const batchFile = `./local_data/batch-ocr/recipes-${index + 1}.jsonl`

  for (const recipe of batch) {
    for (const page of recipe.pages) {
      console.log(`Processing ${page}`)

      const base64Image = await encodeImage(getImagePath(page))
      const url = `data:image/png;base64,${base64Image}`
      const batchEntry = {
        "custom_id": `${recipe.id}-${page.replace(".png", "").replace(" ", "-")}`.toLowerCase(),
        "body": {
          "model": "mistral-ocr-latest",
          "document": {
            "type": "image_url",
            "image_url": url,
          },
          "include_image_base64": false,
        },
      }
      Deno.writeTextFileSync(
        batchFile,
        JSON.stringify(batchEntry) + "\n",
        {
          append: true,
        },
      )
    }
  }
}

// const imagePath = "./local_data/recipes/Doxie 0062.png";
// const base64Image = await encodeImage(imagePath);

// create a batch of ocr requests for the recipes

// const result = await mistral.ocr.process({
//   model: "mistral-ocr-latest",
//   document: {
//     type: "image_url",
//     imageUrl: "data:image/png;base64," + base64Image,
//   },
//   includeImageBase64: true,
// });

// // Replace image placeholders in markdown with base64-encoded images.
// function replaceImagesInMarkdown(
//   markdownStr: string,
//   imagesDict: Record<string, string>,
// ): string {
//   let result = markdownStr;
//   for (const [imgName, base64Str] of Object.entries(imagesDict)) {
//     // Replace markdown image syntax ![imgName](imgName) with ![imgName](base64Str)
//     // We try to match common image markdown patterns for the image id
//     const imagePattern = new RegExp(
//       `!\\[${imgName}\\]\\([^\\)]*${imgName}[^\\)]*\\)`,
//       "g",
//     );
//     result = result.replace(
//       imagePattern,
//       `![${imgName}](${base64Str})`,
//     );
//   }
//   return result;
// }

// // Combine OCR text and images into a single markdown string
// function getCombinedMarkdown(ocrResponse: any): string {
//   const markdowns: string[] = [];

//   for (const page of ocrResponse.pages) {
//     const imageData: Record<string, string> = {};
//     if (page.images && Array.isArray(page.images)) {
//       for (const img of page.images) {
//         // Some OCR results may use camelCase or snake_case, try to support both
//         const base64 = img.imageBase64 ?? img.image_base64 ??
//           img.image_base64_data ?? "";
//         if (base64 && img.id) {
//           imageData[img.id] = base64;
//         }
//       }
//     }
//     markdowns.push(replaceImagesInMarkdown(page.markdown, imageData));
//   }

//   return markdowns.join("\n\n");
// }

// const combinedMarkdown = getCombinedMarkdown(result);

// Deno.writeTextFileSync("test-5.json", JSON.stringify(result, null, 2));
// Deno.writeTextFileSync("test-5.md", result.pages[0].markdown);
// Deno.writeTextFileSync("test-5-combined.md", combinedMarkdown);

// console.log("OCR results saved to ocr-recipes.json");
