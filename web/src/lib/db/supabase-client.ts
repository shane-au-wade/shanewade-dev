import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_KEY

console.log(import.meta.env)

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase = createClient(supabaseUrl, supabaseKey)
