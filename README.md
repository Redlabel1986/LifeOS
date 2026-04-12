# LifeOS

Personal finance & life management. Tracks income, expenses, subscriptions, documents and tax data. Multilingual (de / en / fr / ar with RTL), AI-assisted, built as a monorepo to later ship mobile.

## Stack

- **Monorepo**: pnpm + turbo
- **Backend**: Node.js, Fastify + GraphQL Yoga + Pothos, Prisma, PostgreSQL, BullMQ, Redis
- **Worker**: OCR, AI categorization, subscription detection, renewal reminders
- **Storage**: S3-compatible (MinIO local, S3 prod), presigned URLs for direct uploads
- **AI / OCR**: OpenAI-compatible LLM, Tesseract/Textract/Vision via pluggable abstraction
- **Frontend**: Nuxt 3 (Vue 3), Pinia, Villus (GraphQL), `@nuxtjs/i18n`, **SCSS only** (no Tailwind)
- **i18n**: de default, en, fr, ar (RTL). Tokens via CSS custom properties.

## Structure

```
apps/
├── api/        # GraphQL server
├── web/        # Nuxt 3 app
└── worker/     # BullMQ workers
packages/
├── db/            # Prisma schema + client
├── graphql-schema/ # SDL + codegen types
├── config/        # Zod-validated env
├── ai/            # LLM abstraction
├── ocr/           # OCR abstraction
├── storage/       # S3 adapter
├── mail/          # SMTP
└── utils/         # Money, dates, locale helpers
infra/compose/     # Postgres, Redis, MinIO, MailHog
```

## Quick start

```bash
# 1. infra
docker compose -f infra/compose/docker-compose.yml up -d

# 2. env
cp .env.example .env

# 3. install + generate
pnpm install
pnpm --filter @lifeos/db generate
pnpm --filter @lifeos/db migrate:dev
pnpm --filter @lifeos/db seed

# 4. run
pnpm --filter @lifeos/api dev    # :4000
pnpm --filter @lifeos/worker dev
pnpm --filter @lifeos/web dev    # :3000
```
