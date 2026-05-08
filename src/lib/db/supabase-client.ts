import { createSupabaseClient } from "@lib/db/shared-client"
import type { Supabase } from "@lib/db/shared-client"

const supabaseUrl = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_KEY ?? process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase: Supabase = createSupabaseClient({
  url: supabaseUrl,
  key: supabaseKey,
})
