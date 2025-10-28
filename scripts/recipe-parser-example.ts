/**
 * Example Recipe Parser
 *
 * This demonstrates how to parse the OCR JSONL data into the recipe schema.
 */

import type {
  DifficultyLevel,
  Ingredient,
  IngredientUnit,
  ParsedRecipeData,
  Recipe,
  RecipeProvider,
  RecipeStep,
  SpiceLevel,
} from "./recipe-schema.ts";

// ============================================================================
// Parsing Utilities
// ============================================================================

/**
 * Converts fraction strings to decimals
 * Examples: "3 1/2" -> 3.5, "1/4" -> 0.25, "2-3" -> 2.5 (average)
 */
function parseFractionToDecimal(quantityStr: string): number {
  // Remove extra whitespace
  quantityStr = quantityStr.trim();

  // Handle ranges (e.g., "1-2" or "2 - 3")
  if (quantityStr.includes("-")) {
    const parts = quantityStr.split("-").map((p) =>
      parseFractionToDecimal(p.trim())
    );
    return parts.reduce((a, b) => a + b, 0) / parts.length;
  }

  // Handle mixed fractions (e.g., "3 1/2")
  const mixedMatch = quantityStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    return whole + (numerator / denominator);
  }

  // Handle simple fractions (e.g., "1/2")
  const fractionMatch = quantityStr.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1]);
    const denominator = parseInt(fractionMatch[2]);
    return numerator / denominator;
  }

  // Handle decimal or whole numbers
  const numMatch = quantityStr.match(/[\d.]+/);
  if (numMatch) {
    return parseFloat(numMatch[0]);
  }

  // Default to 0 if can't parse
  return 0;
}

/**
 * Normalizes provider names from OCR text
 */
function parseProvider(text: string): RecipeProvider {
  const normalized = text.toUpperCase().replace(/\s+/g, "_");

  if (normalized.includes("GREEN_CHEF")) return "GREEN_CHEF";
  if (normalized.includes("HELLO_FRESH") || normalized.includes("HELLOFRESH")) {
    return "HELLO_FRESH";
  }
  if (normalized.includes("HOME_CHEF")) return "HOME_CHEF";
  if (normalized.includes("EVERYPLATE") || normalized.includes("EVERY_PLATE")) {
    return "EVERYPLATE";
  }
  if (normalized.includes("MARLEY_SPOON")) return "MARLEY_SPOON";
  if (normalized.includes("DINNERLY")) return "DINNERLY";
  if (normalized.includes("GOBBLE")) return "GOBBLE";
  if (normalized.includes("BLUE_APRON") || normalized.includes("BLUEAPRON")) {
    return "BLUE_APRON";
  }

  return "OTHER";
}

/**
 * Extracts cooking time from various formats
 */
function parseCookTime(text: string): number {
  // Look for patterns like "30 MIN", "20-30 MIN", "COOK TIME 30 MIN"
  const match = text.match(/(\d+)(?:\s*-\s*(\d+))?\s*MIN/i);
  if (match) {
    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    return Math.round((min + max) / 2);
  }
  return 0;
}

/**
 * Extracts calories from text
 */
function parseCalories(text: string): number | undefined {
  const match = text.match(/(\d+)\s*CALORIES/i);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Parses difficulty level
 */
function parseDifficulty(text: string): DifficultyLevel | undefined {
  const normalized = text.toUpperCase();
  if (normalized.includes("EASY")) return "EASY";
  if (normalized.includes("INTERMEDIATE")) return "INTERMEDIATE";
  if (normalized.includes("ADVANCED")) return "ADVANCED";
  if (normalized.includes("QUICK")) return "QUICK";
  return undefined;
}

/**
 * Parses spice level
 */
function parseSpiceLevel(text: string): SpiceLevel | undefined {
  const normalized = text.toUpperCase();
  if (normalized.includes("NOT SPICY")) return "NOT_SPICY";
  if (normalized.includes("VERY SPICY")) return "VERY_SPICY";
  if (normalized.includes("SPICY")) return "SPICY";
  if (normalized.includes("MILD")) return "MILD";
  if (normalized.includes("MEDIUM")) return "MEDIUM";
  return undefined;
}

/**
 * Parses ingredient unit from text
 */
function parseUnit(unitStr: string): IngredientUnit {
  const normalized = unitStr.toLowerCase().trim();

  // Weight
  if (
    normalized === "oz" || normalized === "ounce" || normalized === "ounces"
  ) return "oz";
  if (
    normalized === "lb" || normalized === "pound" || normalized === "pounds"
  ) return "lb";
  if (normalized === "g" || normalized === "gram" || normalized === "grams") {
    return "g";
  }
  if (
    normalized === "kg" || normalized === "kilogram" ||
    normalized === "kilograms"
  ) return "kg";

  // Volume
  if (normalized === "cup" || normalized === "cups") return "cup";
  if (
    normalized === "tbsp" || normalized === "tablespoon" ||
    normalized === "tablespoons"
  ) return "tbsp";
  if (
    normalized === "tsp" || normalized === "teaspoon" ||
    normalized === "teaspoons"
  ) return "tsp";
  if (
    normalized === "ml" || normalized === "milliliter" ||
    normalized === "milliliters"
  ) return "ml";
  if (normalized === "l" || normalized === "liter" || normalized === "liters") {
    return "l";
  }
  if (
    normalized === "fl. oz" || normalized === "fl oz" ||
    normalized === "fluid ounce"
  ) return "fl. oz";

  // Count
  if (normalized === "whole") return "whole";
  if (normalized === "piece" || normalized === "pieces") return "piece";
  if (normalized === "clove" || normalized === "cloves") return "clove";

  // Approximate
  if (normalized === "pinch") return "pinch";
  if (normalized === "dash") return "dash";
  if (normalized.includes("to taste")) return "to taste";

  return "";
}

/**
 * Extracts allergens from text
 */
function parseAllergens(text: string): string[] {
  const allergens: string[] = [];
  const commonAllergens = [
    "MILK",
    "WHEAT",
    "SOY",
    "EGG",
    "EGGS",
    "TREE NUTS",
    "PEANUT",
    "FISH",
    "SHELLFISH",
    "SESAME",
    "COCONUT",
    "GLUTEN",
  ];

  for (const allergen of commonAllergens) {
    if (text.toUpperCase().includes(allergen)) {
      allergens.push(allergen);
    }
  }

  return [...new Set(allergens)]; // Remove duplicates
}

/**
 * Normalizes ingredient names for matching
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Parses a single JSONL line into a Recipe
 */
export function parseRecipeFromOCR(jsonLine: string): ParsedRecipeData {
  const warnings: string[] = [];
  const unparsedFields: string[] = [];

  try {
    const data = JSON.parse(jsonLine);
    const markdown = data.response?.body?.pages?.[0]?.markdown || "";

    if (!markdown) {
      throw new Error("No markdown content found in OCR data");
    }

    // Extract basic metadata
    const provider = parseProvider(markdown);
    const cookTime = parseCookTime(markdown);
    const calories = parseCalories(markdown);
    const difficulty = parseDifficulty(markdown);
    const spiceLevel = parseSpiceLevel(markdown);
    const allergens = parseAllergens(markdown);

    // Extract title (usually first heading)
    const titleMatch = markdown.match(/^#\s+(.+?)$/m) ||
      markdown.match(/^##\s+(.+?)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled Recipe";

    // Extract description (text after title, before ingredients)
    const descMatch = markdown.match(/^[#]+.*?\n\n(.+?)(?=\n\n##|\n\n\|)/ms);
    const description = descMatch
      ? descMatch[1].replace(/\n/g, " ").trim()
      : "";

    // Parse ingredients table
    const ingredients = parseIngredientsFromMarkdown(markdown, warnings);

    // Parse steps
    const steps = parseStepsFromMarkdown(markdown, warnings);

    // Parse equipment
    const equipment = parseEquipmentFromMarkdown(markdown);

    // Extract images
    const images = data.response?.body?.pages?.[0]?.images?.map((img: any) => ({
      id: img.id,
      boundingBox: {
        topLeftX: img.top_left_x,
        topLeftY: img.top_left_y,
        bottomRightX: img.bottom_right_x,
        bottomRightY: img.bottom_right_y,
      },
      imageType: "OTHER" as const,
    })) || [];

    // Build the recipe
    const recipe: Recipe = {
      id: data.custom_id || crypto.randomUUID(),
      title,
      provider,
      createdAt: new Date(),
      updatedAt: new Date(),

      ocrBatchId: data.id,
      ocrCustomId: data.custom_id,
      originalImagePaths: [],
      rawOcrText: markdown,

      description,
      subtitle: undefined,
      extendedDescription: undefined,

      mealTypes: ["DINNER"], // Default, should be inferred
      dietaryTags: [],
      cuisineType: undefined,
      mainProtein: inferMainProtein(ingredients),

      cookTimeMinutes: cookTime,
      prepTimeMinutes: undefined,
      activeTimeMinutes: undefined,
      difficultyLevel: difficulty,
      spiceLevel,
      defaultServings: 2,
      availableServings: [2, 4],

      ingredients,
      steps,
      equipment,
      pantryItems: extractPantryItems(markdown),
      cookWithinDays: extractCookWithinDays(markdown),

      allergens,

      nutrition: {
        caloriesPerServing: calories,
      },

      proteinCustomizations: extractCustomizations(markdown),
      otherCustomizations: [],

      images,

      tips: extractTips(markdown),
      notes: [],
      safetyNotes: extractSafetyNotes(markdown),

      searchKeywords: generateSearchKeywords(title, description, ingredients),
      customTags: [],

      userRating: undefined,
      userNotes: undefined,
      timesCooked: 0,
      lastCookedDate: undefined,
      isFavorite: false,
    };

    // Calculate confidence score
    const confidenceScore = calculateConfidenceScore(recipe, warnings);

    return {
      recipe,
      warnings,
      confidenceScore,
      unparsedFields,
    };
  } catch (error) {
    throw new Error(`Failed to parse recipe: ${error}`);
  }
}

// ============================================================================
// Helper Parsers
// ============================================================================

function parseIngredientsFromMarkdown(
  markdown: string,
  warnings: string[],
): Ingredient[] {
  const ingredients: Ingredient[] = [];

  // Look for ingredient tables (markdown table format)
  const tableMatch = markdown.match(
    /\|\s*(?:2\s+SERVINGS?|SERVINGS)\s*\|.*?\n\|(.*?)\n\n/s,
  );

  if (!tableMatch) {
    warnings.push("Could not find ingredients table");
    return ingredients;
  }

  // Parse table rows
  const rows = tableMatch[0].split("\n").filter((line) =>
    line.startsWith("|") && !line.includes("---") && !line.includes("SERVINGS")
  );

  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim()).filter((c) => c);

    if (cells.length >= 3) {
      const qty2 = cells[0];
      const qty4 = cells[1] || cells[0];
      const name = cells[2];

      // Remove allergen markers and notes
      const cleanName = name.replace(/\s*\(\d+\)\s*$/, "").replace(
        /\s*\*\s*$/,
        "",
      ).trim();

      ingredients.push({
        id: crypto.randomUUID(),
        name: cleanName,
        normalizedName: normalizeIngredientName(cleanName),
        rawQuantity: qty2,
        quantity: parseFractionToDecimal(qty2),
        unit: parseUnit(name) || "whole",
        servings: 2,
        preparation: undefined,
        notes: undefined,
        optional: false,
        category: undefined,
        allergenMarkers: [],
      });
    }
  }

  return ingredients;
}

function parseStepsFromMarkdown(
  markdown: string,
  warnings: string[],
): RecipeStep[] {
  const steps: RecipeStep[] = [];

  // Look for step sections (usually ## HEADING)
  const stepMatches = markdown.matchAll(/##\s+([A-Z\s&]+)\n\n((?:-.+?\n)+)/g);

  let stepNumber = 1;
  for (const match of stepMatches) {
    const title = match[1].trim();
    const instructions = match[2]
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((line) => line.replace(/^-\s*/, "").trim())
      .join(" ");

    if (instructions) {
      steps.push({
        stepNumber: stepNumber++,
        title,
        instruction: instructions,
        estimatedTime: undefined,
        temperature: extractTemperature(instructions),
        temperatureUnit: "F",
        equipment: [],
        ingredientIds: [],
        visualCues: extractVisualCues(instructions),
        tips: [],
      });
    }
  }

  return steps;
}

function parseEquipmentFromMarkdown(markdown: string): string[] {
  const equipment: string[] = [];

  // Look for "WHAT YOU'LL NEED" or "BUST OUT" sections
  const equipMatch = markdown.match(
    /(?:WHAT YOU'LL NEED|BUST OUT)[:\s]+(.*?)(?=\n\n##|\n\n\*|$)/s,
  );

  if (equipMatch) {
    const equipText = equipMatch[1];
    // Split by common separators
    const items = equipText.split(/\s+/).filter((item) =>
      item.length > 3 && !item.match(/^(and|or|the|a|an)$/i)
    );
    equipment.push(...items);
  }

  return equipment;
}

function extractPantryItems(markdown: string): string[] {
  const pantryItems: string[] = [];
  const common = [
    "salt",
    "pepper",
    "oil",
    "olive oil",
    "cooking oil",
    "butter",
    "sugar",
  ];

  for (const item of common) {
    if (markdown.toLowerCase().includes(item)) {
      pantryItems.push(item);
    }
  }

  return [...new Set(pantryItems)];
}

function extractCookWithinDays(markdown: string): number | undefined {
  const match = markdown.match(/(?:COOK WITHIN|Cook Within)\s+(\d+)\s+DAYS?/i);
  return match ? parseInt(match[1]) : undefined;
}

function extractCustomizations(markdown: string): string[] {
  const customizations: string[] = [];
  const custMatch = markdown.match(/CUSTOMIZE.*?:(.*?)(?=\n\n|\*|$)/s);

  if (custMatch) {
    const items = custMatch[1].match(/[A-Z][a-z]+(?:\s+[a-z]+)*/g);
    if (items) customizations.push(...items);
  }

  return customizations;
}

function extractTips(markdown: string): string[] {
  const tips: string[] = [];

  // Look for tip sections or callouts
  const tipMatches = markdown.matchAll(
    /(?:\*\*|##)\s*(?:TIP|PRO TIP|NOTE)[:\s]+(.*?)(?=\n\n|$)/gs,
  );

  for (const match of tipMatches) {
    tips.push(match[1].trim());
  }

  return tips;
}

function extractSafetyNotes(markdown: string): string[] {
  const notes: string[] = [];

  if (markdown.includes("internal temperature")) {
    const match = markdown.match(/\*.*?internal temperature.*?(?=\n|$)/i);
    if (match) notes.push(match[0]);
  }

  if (markdown.includes("foodborne illness")) {
    const match = markdown.match(/Consuming raw.*?foodborne illness\.?/i);
    if (match) notes.push(match[0]);
  }

  return notes;
}

function extractTemperature(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(?:degrees|°)/i);
  return match ? parseInt(match[1]) : undefined;
}

function extractVisualCues(text: string): string[] {
  const cues: string[] = [];
  const patterns = [
    /until\s+([^.,]+)/gi,
    /or\s+until\s+([^.,]+)/gi,
    /when\s+([^.,]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      cues.push(match[1].trim());
    }
  }

  return cues;
}

function inferMainProtein(ingredients: Ingredient[]): string | undefined {
  const proteins = [
    "pork",
    "chicken",
    "beef",
    "fish",
    "tofu",
    "turkey",
    "lamb",
    "shrimp",
  ];

  for (const ingredient of ingredients) {
    const normalized = ingredient.normalizedName;
    for (const protein of proteins) {
      if (normalized.includes(protein)) {
        return protein.charAt(0).toUpperCase() + protein.slice(1);
      }
    }
  }

  return undefined;
}

function generateSearchKeywords(
  title: string,
  description: string,
  ingredients: Ingredient[],
): string[] {
  const keywords = new Set<string>();

  // Add words from title
  title.toLowerCase().split(/\s+/).forEach((word) => {
    if (word.length > 3) keywords.add(word);
  });

  // Add ingredient names
  ingredients.forEach((ing) => {
    ing.normalizedName.split(/\s+/).forEach((word) => {
      if (word.length > 3) keywords.add(word);
    });
  });

  return Array.from(keywords);
}

function calculateConfidenceScore(recipe: Recipe, warnings: string[]): number {
  let score = 1.0;

  // Deduct for missing critical fields
  if (!recipe.title || recipe.title === "Untitled Recipe") score -= 0.2;
  if (recipe.ingredients.length === 0) score -= 0.3;
  if (recipe.steps.length === 0) score -= 0.3;
  if (recipe.cookTimeMinutes === 0) score -= 0.1;

  // Deduct for warnings
  score -= warnings.length * 0.05;

  return Math.max(0, score);
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Processes an entire JSONL file
 */
export async function parseRecipeJSONL(
  filePath: string,
): Promise<ParsedRecipeData[]> {
  const text = await Deno.readTextFile(filePath);
  const lines = text.split("\n").filter((line) => line.trim());

  const results: ParsedRecipeData[] = [];

  for (const line of lines) {
    try {
      const parsed = parseRecipeFromOCR(line);
      results.push(parsed);
    } catch (error) {
      console.error(`Error parsing line: ${error}`);
    }
  }

  return results;
}

/**
 * Example usage
 */
if (import.meta.main) {
  const results = await parseRecipeJSONL(
    "./batch-ocr-results-recipes-1-to-25.jsonl",
  );

  console.log(`Parsed ${results.length} recipes`);
  console.log("\nFirst recipe:");
  console.log(JSON.stringify(results[0].recipe, null, 2));

  console.log("\nConfidence scores:");
  results.forEach((r, i) => {
    console.log(
      `Recipe ${i + 1}: ${r.recipe.title} - ${
        (r.confidenceScore * 100).toFixed(1)
      }%`,
    );
    if (r.warnings.length > 0) {
      console.log(`  Warnings: ${r.warnings.join(", ")}`);
    }
  });
}
