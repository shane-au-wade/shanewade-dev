/**
 * Database Sync Script
 *
 * Syncs recipes and recipe iterations from one Supabase database to another.
 * Useful for migrating data between environments (local -> production, staging -> production, etc.)
 *
 * Environment Variables:
 * - SUPABASE_URL: Source database URL
 * - SUPABASE_KEY: Source database service role key
 * - PROD_SUPABASE_URL: Destination database URL
 * - PROD_SUPABASE_KEY: Destination database service role key
 *
 * Usage:
 *   deno run -A scripts/db/sync-database.ts
 */

import { load } from "@std/dotenv"
import { assert } from "@std/assert"
import { createSupabaseClient, type Supabase } from "@shared/core/db/client"
import { getAllRecipes, getRecipe } from "@shared/core/recipes/queries"
import { uploadRecipe } from "@shared/core/recipes/mutations"

// Load environment variables
const env = await load({
  envPath: ".env",
  export: true,
})

// Validate required environment variables
assert(env.SUPABASE_URL, "FROM_SUPABASE_URL is not set in .env")
assert(env.SUPABASE_KEY, "FROM_SUPABASE_KEY is not set in .env")
assert(env.PROD_SUPABASE_URL, "TO_SUPABASE_URL is not set in .env")
assert(env.PROD_SUPABASE_KEY, "TO_SUPABASE_KEY is not set in .env")

// Create source and destination Supabase clients
const fromClient = createSupabaseClient({
  url: env.SUPABASE_URL,
  key: env.SUPABASE_KEY,
})

const toClient = createSupabaseClient({
  url: env.PROD_SUPABASE_URL,
  key: env.PROD_SUPABASE_KEY,
})

console.log("🔄 Starting database sync...")
console.log(`📤 Source: ${env.FROM_SUPABASE_URL}`)
console.log(`📥 Destination: ${env.TO_SUPABASE_URL}`)
console.log()

async function getAllIterations(supabase: Supabase, recipeId: string) {
  const { data, error } = await supabase
    .from("recipe_iterations")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("version", { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch iterations: ${error.message}`)
  }

  return data ?? []
}

async function upsertIterations(
  supabase: Supabase,
  iterations: Awaited<ReturnType<typeof getAllIterations>>,
) {
  if (iterations.length === 0) return 0

  const { error } = await supabase
    .from("recipe_iterations")
    .upsert(iterations, { onConflict: "id" })

  if (error) {
    throw new Error(`Failed to upsert iterations: ${error.message}`)
  }

  return iterations.length
}

async function syncAll() {
  try {
    console.log("📋 Fetching recipes from source database...")
    const recipes = await getAllRecipes(fromClient)
    console.log(`✅ Found ${recipes.length} recipes to sync`)
    console.log()

    let recipeSuccessCount = 0
    let recipeErrorCount = 0
    let iterationTotal = 0
    const errors: Array<{ recipeId: string; title: string; error: string }> = []

    for (let i = 0; i < recipes.length; i++) {
      const recipeSummary = recipes[i]
      const recipeNum = i + 1

      try {
        console.log(
          `[${recipeNum}/${recipes.length}] Syncing: ${recipeSummary.title}`,
        )

        const recipe = await getRecipe(fromClient, recipeSummary.id)

        if (!recipe) {
          throw new Error(`Recipe not found: ${recipeSummary.id}`)
        }

        await uploadRecipe(toClient, recipe)

        const iterations = await getAllIterations(fromClient, recipeSummary.id)
        const iterationCount = await upsertIterations(toClient, iterations)
        iterationTotal += iterationCount

        recipeSuccessCount++
        const iterMsg = iterationCount > 0 ? ` (${iterationCount} iterations)` : ""
        console.log(`  ✅ Successfully synced${iterMsg}`)
      } catch (error) {
        recipeErrorCount++
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(`  ❌ Failed: ${errorMessage}`)
        errors.push({
          recipeId: recipeSummary.id,
          title: recipeSummary.title,
          error: errorMessage,
        })
      }

      console.log()
    }

    console.log("=".repeat(60))
    console.log("📊 Sync Summary")
    console.log("=".repeat(60))
    console.log(`Total recipes: ${recipes.length}`)
    console.log(`✅ Successful: ${recipeSuccessCount}`)
    console.log(`❌ Failed: ${recipeErrorCount}`)
    console.log(`🔄 Iterations synced: ${iterationTotal}`)
    console.log()

    if (errors.length > 0) {
      console.log("Failed recipes:")
      for (const error of errors) {
        console.log(`  • ${error.title} (${error.recipeId})`)
        console.log(`    Error: ${error.error}`)
      }
      console.log()
    }

    console.log("🎉 Sync complete!")
  } catch (error) {
    console.error("❌ Fatal error during sync:")
    console.error(error)
    Deno.exit(1)
  }
}

await syncAll()
