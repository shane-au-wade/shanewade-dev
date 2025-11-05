import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "./types.ts"

export type Supabase = SupabaseClient<Database>
export type { Json }

/**
 * Configuration for creating a Supabase client
 */
export interface SupabaseConfig {
  url: string
  key: string
}

/**
 * Create a typed Supabase client
 * 
 * @example
 * // In Astro (web)
 * const supabase = createSupabaseClient({
 *   url: import.meta.env.SUPABASE_URL,
 *   key: import.meta.env.SUPABASE_KEY
 * })
 * 
 * @example
 * // In Deno scripts
 * const supabase = createSupabaseClient({
 *   url: Deno.env.get("SUPABASE_URL")!,
 *   key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
 * })
 */
export function createSupabaseClient(config: SupabaseConfig): Supabase {
  if (!config.url || !config.key) {
    throw new Error("Missing Supabase configuration: url and key are required")
  }

  return createClient<Database>(config.url, config.key)
}

