-- Add new fields to ingredients table for better normalization
ALTER TABLE ingredients 
  ADD COLUMN is_pantry_staple BOOLEAN DEFAULT false,
  ADD COLUMN preparation_note TEXT;

-- Add check constraint for normalized units
ALTER TABLE ingredients
  ADD CONSTRAINT unit_normalized CHECK (
    unit IS NULL OR 
    unit IN (
      'oz', 'lb', 'g', 'kg',           -- Weight
      'cup', 'tbsp', 'tsp', 'ml', 'l', -- Volume
      'whole', 'slice', 'clove',       -- Count-based
      'pinch', 'dash',                 -- Approximate
      'fl oz'                          -- Fluid ounces
    )
  );

-- Create index on is_pantry_staple for faster grocery list queries
CREATE INDEX idx_ingredients_is_pantry_staple ON ingredients(is_pantry_staple);

-- Add comment explaining the fields
COMMENT ON COLUMN ingredients.is_pantry_staple IS 'True for common pantry items (salt, pepper, oil) that should show "as needed" in grocery lists';
COMMENT ON COLUMN ingredients.preparation_note IS 'Preparation instructions like "diced", "minced", "peeled" extracted from the recipe';
COMMENT ON CONSTRAINT unit_normalized ON ingredients IS 'Ensures units are normalized (no periods, standardized names)';

