import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types.ts"

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_KEY

console.log(import.meta.env)

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

export type Supabase = SupabaseClient<Database>
