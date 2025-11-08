# Database Scripts

This directory contains scripts for managing and syncing the Supabase database.

## sync-database.ts

Syncs recipes from one Supabase database to another. Useful for migrating data between environments (local → production, staging → production, etc.)

### Environment Variables

Add these to your `.env` file:

```env
# Source database (where to copy FROM)
FROM_SUPABASE_URL=https://your-source-project.supabase.co
FROM_SUPABASE_KEY=your-source-service-role-key

# Destination database (where to copy TO)
TO_SUPABASE_URL=https://your-destination-project.supabase.co
TO_SUPABASE_KEY=your-destination-service-role-key
```

**Important:** Use service role keys (not anon keys) for both databases to ensure you have the necessary permissions to read and write all data.

### Usage

```bash
# From the repository root
deno run -A scripts/db/sync-database.ts
```

### What it does

1. Connects to both source and destination databases
2. Fetches all recipe IDs from the source database
3. For each recipe:
   - Retrieves complete recipe data (including ingredients, steps, mise en place, and cooking tools)
   - Uploads the recipe to the destination database
4. Provides a summary of successful and failed syncs

### Example Output

```
🔄 Starting database sync...
📤 Source: https://source.supabase.co
📥 Destination: https://destination.supabase.co

📋 Fetching recipes from source database...
✅ Found 25 recipes to sync

[1/25] Syncing: Chicken Tikka Masala
  ✅ Successfully synced

[2/25] Syncing: Beef Wellington
  ✅ Successfully synced

...

============================================================
📊 Sync Summary
============================================================
Total recipes: 25
✅ Successful: 25
❌ Failed: 0

🎉 Sync complete!
```

### Error Handling

- If a recipe fails to sync, the script will continue with the remaining recipes
- Failed recipes are logged with their error messages in the final summary
- The script exits with code 1 if a fatal error occurs

### Notes

- Recipes are synced one at a time (not in parallel) to avoid overwhelming the database
- Existing recipes with the same ID in the destination will cause an error (no overwriting)
- All related data (ingredients, steps, etc.) are synced together with each recipe
