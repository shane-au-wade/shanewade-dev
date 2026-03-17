CREATE TABLE recipe_iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  prompt TEXT NOT NULL,
  recipe_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_iterations_recipe_id ON recipe_iterations(recipe_id);
CREATE INDEX idx_recipe_iterations_latest ON recipe_iterations(recipe_id, version DESC);
