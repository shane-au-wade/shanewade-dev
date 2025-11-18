import { createClient } from "@supabase/supabase-js"
import type { Database } from "@shared/db/types"

// These PUBLIC_ prefixed env vars are available in the browser
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing public Supabase environment variables")
}

// Create a singleton client for the browser
export const supabaseBrowser = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    // Optional: Configure realtime settings
    params: {
      eventsPerSecond: 10,
    },
  },
})
