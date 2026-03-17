set dotenv-load

# Development

[doc('Run web dev server')]
[group('dev')]
dev:
    deno task web

[doc('Run API dev server')]
[group('dev')]
api:
    deno task api

[doc('Open interactive REPL')]
[group('dev')]
repl:
    deno task repl

# Build / Deploy

[doc('Build the Astro site')]
[group('build')]
build:
    deno task build

[doc('Preview production build')]
[group('build')]
preview:
    deno task preview

# Database

[doc('Start local Postgres container')]
[group('db')]
db:
    supabase start

[doc('Open Supabase Studio')]
[group('db')]
studio:
    deno task supabase-studio

[doc('Regenerate TypeScript types from DB schema')]
[group('db')]
db-typegen:
    deno task db-typegen

[doc('Sync recipes to production')]
[group('db')]
db-sync:
    deno run -A scripts/db/sync-database.ts

# Recipe Pipeline

[doc('Run macOS Vision OCR on recipe images')]
[group('recipes')]
ocr:
    deno run -A scripts/ocr/mac-ocr-batch.ts

[doc('Extract structured recipes from OCR results into DB')]
[group('recipes')]
extract:
    deno run -A scripts/eval/extract.ts

[doc('Iterate on a recipe with an AI prompt')]
[group('recipes')]
iterate recipe_id +prompt:
    deno run -A scripts/recipes/iterate.ts {{recipe_id}} "{{prompt}}"

[doc('Run full recipe pipeline: OCR then extract')]
[group('recipes')]
recipe-pipeline: ocr extract

# Infrastructure

[doc('Start ChromaDB container')]
[group('infra')]
chroma:
    deno task chroma

# Formatting

[doc('Run deno fmt')]
[group('fmt')]
fmt:
    deno fmt
