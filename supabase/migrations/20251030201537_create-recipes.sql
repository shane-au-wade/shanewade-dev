-- Create recipes table
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    company_name TEXT,
    servings integer,
    cook_time_minutes integer,
    cooking_tips TEXT,
    ocr_markdown TEXT,
    ocr_results JSONB,
    pages TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ingredients table
CREATE TABLE ingredients (
    id BIGSERIAL PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    quantity NUMERIC,
    unit TEXT,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create steps table
CREATE TABLE steps (
    id BIGSERIAL PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create mise en place steps table
CREATE TABLE mise_en_place_steps (
    id BIGSERIAL PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cooking tools table
CREATE TABLE cooking_tools (
    id BIGSERIAL PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_ingredients_recipe_id ON ingredients(recipe_id);
CREATE INDEX idx_steps_recipe_id ON steps(recipe_id);
CREATE INDEX idx_mise_en_place_steps_recipe_id ON mise_en_place_steps(recipe_id);
CREATE INDEX idx_cooking_tools_recipe_id ON cooking_tools(recipe_id);
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_company_name ON recipes(company_name);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to recipes table
CREATE TRIGGER update_recipes_updated_at 
    BEFORE UPDATE ON recipes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

