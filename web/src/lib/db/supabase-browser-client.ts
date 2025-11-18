import { createClient } from "@supabase/supabase-js"
import type { Database } from "@shared/db/types"

// These PUBLIC_ prefixed env vars are available in the browser
const supabaseUrl = "https://ytqyxjbeuyapghqawghy.supabase.co"
const supabaseAnonKey = "sb_publishable_aNf95Wol0NIHkG-eVEnddQ_plivu8hc"

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
