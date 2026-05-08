set dotenv-load

# Development

[doc('Run dev server')]
[group('dev')]
dev:
    npm run dev

# Build / Preview

[doc('Build for production')]
[group('build')]
build:
    npm run build

[doc('Preview production build')]
[group('build')]
preview:
    npm run preview

[doc('Type-check the project')]
[group('build')]
typecheck:
    npm run typecheck

# Database

[doc('Start local Supabase')]
[group('db')]
db:
    supabase start

[doc('Open Supabase Studio')]
[group('db')]
studio:
    open 'http://127.0.0.1:54323/'

[doc('Regenerate TypeScript types from DB schema')]
[group('db')]
db-typegen:
    supabase gen types typescript --local > src/lib/db/types.ts

# Formatting

[doc('Run prettier')]
[group('fmt')]
fmt:
    npm run format 2>/dev/null || npx prettier --write .
