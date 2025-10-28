-- ============================================================================
-- Recipe Database Schema for PostgreSQL
-- ============================================================================
-- 
-- This schema supports:
-- - Recipe storage and management
-- - Meal planning
-- - Shopping list generation
-- - User preferences and history
--
-- Usage:
--   psql -U postgres -d recipes -f recipe-schema.sql
--

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Core Recipe Tables
-- ============================================================================

-- Main recipes table
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  
  -- Descriptions
  description TEXT,
  subtitle TEXT,
  extended_description TEXT,
  
  -- Classification
  meal_types TEXT[] DEFAULT '{}',
  dietary_tags TEXT[] DEFAULT '{}',
  cuisine_type VARCHAR(100),
  main_protein VARCHAR(50),
  
  -- Cooking details
  cook_time_minutes INTEGER,
  prep_time_minutes INTEGER,
  active_time_minutes INTEGER,
  difficulty_level VARCHAR(20),
  spice_level VARCHAR(20),
  default_servings INTEGER DEFAULT 2,
  available_servings INTEGER[] DEFAULT '{2,4}',
  
  -- Equipment and requirements
  equipment TEXT[] DEFAULT '{}',
  pantry_items TEXT[] DEFAULT '{}',
  cook_within_days INTEGER,
  
  -- Allergens
  allergens TEXT[] DEFAULT '{}',
  
  -- Nutrition (stored as JSONB for flexibility)
  nutrition JSONB,
  
  -- Customization
  protein_customizations TEXT[] DEFAULT '{}',
  other_customizations TEXT[] DEFAULT '{}',
  
  -- Tips and notes
  tips TEXT[] DEFAULT '{}',
  notes TEXT[] DEFAULT '{}',
  safety_notes TEXT[] DEFAULT '{}',
  
  -- Search
  search_keywords TEXT[] DEFAULT '{}',
  custom_tags TEXT[] DEFAULT '{}',
  
  -- OCR metadata
  ocr_batch_id TEXT,
  ocr_custom_id TEXT,
  original_image_paths TEXT[] DEFAULT '{}',
  raw_ocr_text TEXT,
  
  -- Full recipe data as JSONB (for complex nested structures)
  raw_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_recipes_provider ON recipes(provider);
CREATE INDEX idx_recipes_cook_time ON recipes(cook_time_minutes);
CREATE INDEX idx_recipes_difficulty ON recipes(difficulty_level);
CREATE INDEX idx_recipes_main_protein ON recipes(main_protein);
CREATE INDEX idx_recipes_meal_types ON recipes USING GIN(meal_types);
CREATE INDEX idx_recipes_dietary_tags ON recipes USING GIN(dietary_tags);
CREATE INDEX idx_recipes_allergens ON recipes USING GIN(allergens);
CREATE INDEX idx_recipes_search_keywords ON recipes USING GIN(search_keywords);

-- Full-text search on title and description
CREATE INDEX idx_recipes_text_search ON recipes 
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ============================================================================
-- Ingredients
-- ============================================================================

-- Master ingredient list (normalized)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  normalized_name TEXT UNIQUE NOT NULL,
  category VARCHAR(50),
  common_unit VARCHAR(20),
  
  -- Average cost (can be updated from shopping data)
  avg_cost_per_unit DECIMAL(10, 2),
  avg_cost_unit VARCHAR(20),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ingredients_normalized_name ON ingredients(normalized_name);
CREATE INDEX idx_ingredients_category ON ingredients(category);

-- Recipe-ingredient relationships (junction table)
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  
  -- Quantity details
  raw_quantity TEXT,
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20),
  servings INTEGER NOT NULL DEFAULT 2,
  
  -- Preparation
  preparation TEXT,
  notes TEXT,
  optional BOOLEAN DEFAULT FALSE,
  
  -- Allergen markers from recipe
  allergen_markers TEXT[] DEFAULT '{}',
  
  -- Order in recipe (for display)
  sort_order INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

-- ============================================================================
-- Recipe Steps
-- ============================================================================

CREATE TABLE recipe_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  
  step_number INTEGER NOT NULL,
  title TEXT,
  instruction TEXT NOT NULL,
  
  -- Time and temperature
  estimated_time_minutes INTEGER,
  temperature INTEGER,
  temperature_unit CHAR(1) CHECK (temperature_unit IN ('F', 'C')),
  
  -- Equipment needed
  equipment TEXT[] DEFAULT '{}',
  
  -- Related ingredients (references to ingredient IDs)
  ingredient_ids UUID[] DEFAULT '{}',
  
  -- Visual cues and tips
  visual_cues TEXT[] DEFAULT '{}',
  tips TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(recipe_id, step_number)
);

CREATE INDEX idx_recipe_steps_recipe ON recipe_steps(recipe_id);
CREATE INDEX idx_recipe_steps_order ON recipe_steps(recipe_id, step_number);

-- ============================================================================
-- Recipe Images
-- ============================================================================

CREATE TABLE recipe_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  
  -- OCR image ID
  ocr_image_id TEXT,
  
  -- Image location
  image_path TEXT,
  image_url TEXT,
  
  -- Bounding box from OCR
  bounding_box JSONB,
  
  -- Image metadata
  image_type VARCHAR(20) CHECK (image_type IN ('HERO', 'STEP', 'INGREDIENT', 'OTHER')),
  alt_text TEXT,
  
  -- Order for display
  sort_order INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recipe_images_recipe ON recipe_images(recipe_id);

-- ============================================================================
-- Meal Planning
-- ============================================================================

CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- User reference (if multi-user system)
  user_id UUID,
  
  -- Plan metadata
  total_calories INTEGER,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meal_plans_user ON meal_plans(user_id);
CREATE INDEX idx_meal_plans_dates ON meal_plans(start_date, end_date);

-- Individual meals in a plan
CREATE TABLE planned_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  meal_type VARCHAR(20) NOT NULL CHECK (
    meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'DESSERT', 'APPETIZER')
  ),
  
  servings INTEGER NOT NULL DEFAULT 2,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_planned_meals_plan ON planned_meals(meal_plan_id);
CREATE INDEX idx_planned_meals_recipe ON planned_meals(recipe_id);
CREATE INDEX idx_planned_meals_date ON planned_meals(scheduled_date);

-- ============================================================================
-- Shopping Lists
-- ============================================================================

CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Total estimated cost
  estimated_total_cost DECIMAL(10, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shopping_lists_meal_plan ON shopping_lists(meal_plan_id);

-- Shopping list items
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  
  -- Display info
  ingredient_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  
  -- Aggregated quantity
  total_quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20),
  category VARCHAR(50),
  
  -- Which recipes need this
  recipe_ids UUID[] DEFAULT '{}',
  
  -- Shopping status
  checked BOOLEAN DEFAULT FALSE,
  checked_at TIMESTAMP WITH TIME ZONE,
  
  -- Cost tracking
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  
  -- Notes
  notes TEXT,
  
  -- Order for shopping (by aisle/category)
  sort_order INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_list_items_ingredient ON shopping_list_items(ingredient_id);
CREATE INDEX idx_shopping_list_items_category ON shopping_list_items(category);

-- ============================================================================
-- User Data
-- ============================================================================

-- User recipe interactions
CREATE TABLE user_recipe_data (
  user_id UUID NOT NULL,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  
  -- Ratings and favorites
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Cooking history
  times_cooked INTEGER DEFAULT 0,
  last_cooked_date TIMESTAMP WITH TIME ZONE,
  
  -- User notes
  notes TEXT,
  
  -- Modifications/customizations made
  modifications JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX idx_user_recipe_data_user ON user_recipe_data(user_id);
CREATE INDEX idx_user_recipe_data_recipe ON user_recipe_data(recipe_id);
CREATE INDEX idx_user_recipe_data_rating ON user_recipe_data(rating);
CREATE INDEX idx_user_recipe_data_favorite ON user_recipe_data(is_favorite);

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- Popular recipes view
CREATE VIEW popular_recipes AS
SELECT 
  r.*,
  COUNT(urd.user_id) as total_cooks,
  AVG(urd.rating) as avg_rating,
  COUNT(CASE WHEN urd.is_favorite THEN 1 END) as favorite_count
FROM recipes r
LEFT JOIN user_recipe_data urd ON r.id = urd.recipe_id
GROUP BY r.id;

-- Complete recipe view with ingredient count
CREATE VIEW recipes_with_stats AS
SELECT 
  r.*,
  COUNT(DISTINCT ri.ingredient_id) as ingredient_count,
  COUNT(DISTINCT rs.id) as step_count,
  COUNT(DISTINCT rim.id) as image_count
FROM recipes r
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
LEFT JOIN recipe_steps rs ON r.id = rs.recipe_id
LEFT JOIN recipe_images rim ON r.id = rim.recipe_id
GROUP BY r.id;

-- Upcoming meals view
CREATE VIEW upcoming_meals AS
SELECT 
  pm.*,
  r.title as recipe_title,
  r.cook_time_minutes,
  r.difficulty_level,
  mp.name as meal_plan_name
FROM planned_meals pm
JOIN recipes r ON pm.recipe_id = r.id
JOIN meal_plans mp ON pm.meal_plan_id = mp.id
WHERE pm.completed = FALSE
  AND pm.scheduled_date >= CURRENT_DATE
ORDER BY pm.scheduled_date;

-- ============================================================================
-- Functions
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update_updated_at trigger to relevant tables
CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_recipe_data_updated_at
  BEFORE UPDATE ON user_recipe_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to search recipes by text
CREATE OR REPLACE FUNCTION search_recipes(search_query TEXT)
RETURNS TABLE (
  recipe_id UUID,
  title TEXT,
  description TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.description,
    ts_rank(
      to_tsvector('english', r.title || ' ' || COALESCE(r.description, '')),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM recipes r
  WHERE to_tsvector('english', r.title || ' ' || COALESCE(r.description, ''))
    @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get all ingredients for a recipe (with quantities)
CREATE OR REPLACE FUNCTION get_recipe_ingredients(p_recipe_id UUID)
RETURNS TABLE (
  ingredient_name TEXT,
  quantity DECIMAL,
  unit VARCHAR,
  preparation TEXT,
  optional BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.name,
    ri.quantity,
    ri.unit,
    ri.preparation,
    ri.optional
  FROM recipe_ingredients ri
  JOIN ingredients i ON ri.ingredient_id = i.id
  WHERE ri.recipe_id = p_recipe_id
  ORDER BY ri.sort_order, i.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Sample Data Insert Functions
-- ============================================================================

-- Function to insert a complete recipe
CREATE OR REPLACE FUNCTION insert_recipe(
  p_title TEXT,
  p_provider VARCHAR(50),
  p_description TEXT,
  p_cook_time_minutes INTEGER,
  p_raw_data JSONB
)
RETURNS UUID AS $$
DECLARE
  v_recipe_id UUID;
BEGIN
  INSERT INTO recipes (
    title,
    provider,
    description,
    cook_time_minutes,
    raw_data
  ) VALUES (
    p_title,
    p_provider,
    p_description,
    p_cook_time_minutes,
    p_raw_data
  ) RETURNING id INTO v_recipe_id;
  
  RETURN v_recipe_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE recipes IS 'Main recipes table storing all recipe metadata and references';
COMMENT ON TABLE ingredients IS 'Normalized master list of all ingredients across recipes';
COMMENT ON TABLE recipe_ingredients IS 'Junction table linking recipes to ingredients with quantities';
COMMENT ON TABLE recipe_steps IS 'Step-by-step cooking instructions for each recipe';
COMMENT ON TABLE meal_plans IS 'User meal plans for organizing weekly/monthly cooking';
COMMENT ON TABLE planned_meals IS 'Individual meals scheduled within a meal plan';
COMMENT ON TABLE shopping_lists IS 'Shopping lists generated from meal plans';
COMMENT ON TABLE shopping_list_items IS 'Individual items in a shopping list with aggregated quantities';
COMMENT ON TABLE user_recipe_data IS 'User-specific data like ratings, favorites, and cooking history';

COMMENT ON COLUMN recipes.raw_data IS 'Complete recipe object as JSONB for flexibility';
COMMENT ON COLUMN ingredients.normalized_name IS 'Lowercase, singular form for matching and deduplication';
COMMENT ON COLUMN recipe_ingredients.servings IS 'Number of servings the quantity is for';
COMMENT ON COLUMN shopping_list_items.recipe_ids IS 'Array of recipe UUIDs that require this ingredient';

-- ============================================================================
-- Permissions (example, adjust as needed)
-- ============================================================================

-- Create a role for the application
-- CREATE ROLE recipe_app WITH LOGIN PASSWORD 'secure_password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO recipe_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO recipe_app;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Additional composite indexes for common query patterns
CREATE INDEX idx_recipes_quick_search ON recipes(cook_time_minutes, difficulty_level)
  WHERE cook_time_minutes < 30;

CREATE INDEX idx_recipes_vegetarian ON recipes USING GIN(dietary_tags)
  WHERE 'VEGETARIAN' = ANY(dietary_tags);

CREATE INDEX idx_planned_meals_week ON planned_meals(meal_plan_id, scheduled_date)
  WHERE scheduled_date >= CURRENT_DATE 
    AND scheduled_date < CURRENT_DATE + INTERVAL '7 days';

-- ============================================================================
-- End of Schema
-- ============================================================================

-- Display success message
DO $$
BEGIN
  RAISE NOTICE 'Recipe database schema created successfully!';
  RAISE NOTICE 'Tables: recipes, ingredients, recipe_ingredients, recipe_steps, recipe_images';
  RAISE NOTICE 'Tables: meal_plans, planned_meals, shopping_lists, shopping_list_items';
  RAISE NOTICE 'Tables: user_recipe_data';
  RAISE NOTICE 'Views: popular_recipes, recipes_with_stats, upcoming_meals';
END $$;

