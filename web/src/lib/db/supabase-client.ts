import { createSupabaseClient } from "@shared/db/client"
import type { Supabase } from "@shared/db/client"

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_KEY

console.log(import.meta.env)

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase: Supabase = createSupabaseClient({
  url: supabaseUrl,
  key: supabaseKey,
})
