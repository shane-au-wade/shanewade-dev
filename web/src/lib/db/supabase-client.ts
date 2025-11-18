import { createSupabaseClient } from "@shared/db/client"
import type { Supabase } from "@shared/db/client"

const supabaseUrl = import.meta.env.SUPABASE_URL ?? Deno.env.get("SUPABASE_URL")
const supabaseKey = import.meta.env.SUPABASE_KEY ?? Deno.env.get("SUPABASE_KEY")

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase: Supabase = createSupabaseClient({
  url: supabaseUrl,
  key: supabaseKey,
})
