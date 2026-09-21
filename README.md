# Zenova LifeScore

Health & fitness app that rolls sleep, nutrition, workouts and recovery into a
single daily **LifeScore**, with an AI coach, photo-based food logging and
Apple Health / Health Connect sync.

Expo SDK 55 · React Native 0.83 · expo-router · TypeScript · Supabase ·
Zustand · TanStack Query · RevenueCat · PostHog

## Repositories

| Repo | Purpose |
|------|---------|
| [Fitness-APP](https://github.com/emirhanyenici/Fitness-APP) | Main app source (this repo). Day-to-day development happens here. |
| [zenova-lifescore-release](https://github.com/emirhanyenici/zenova-lifescore-release) | Release mirror of this repo. Keep `master` in sync when cutting a store build. |
| [Zenova-Lifescore](https://github.com/emirhanyenici/Zenova-Lifescore) | Marketing / legal site (Next.js) served at `zenovaapp.com` — Privacy Policy, Terms, Delete Account page linked from the app and store listings. |
| [zenova-db-backups](https://github.com/emirhanyenici/zenova-db-backups) | Encrypted nightly Postgres dumps written by the `DB Backup` workflow in this repo. |

## Getting started

Requires Node 20+ (CI uses 20).

```bash
npm ci --legacy-peer-deps   # peer-dep conflicts require the flag
cp .env.example .env         # fill in Supabase / RevenueCat / PostHog keys
npm start                    # expo start
```

Provider API keys (xAI, USDA, RapidAPI) are **not** client env vars — they
live only in Supabase Edge Function secrets and are proxied server-side.
See `.env.example`.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm start` / `npm run ios` / `npm run android` | Expo dev server / native run |
| `npm test` | Jest suite (`__tests__/`) |
| `npm run typecheck` | `tsc --noEmit` |
| `bash scripts/githooks/install-hooks.sh` | Installs the pre-commit / pre-push hooks (typecheck + tests before push) |

## Project layout

```
app/            expo-router screens: (auth), (onboarding), (tabs), modals/, paywall
components/     shared UI
constants/      colors, typography, spacing, achievements, legal copy
hooks/          React hooks
services/       API clients (supabase, usda, exercisedb, purchases, healthkit, …)
stores/         Zustand stores (auth, user, workout, nutrition, subscription, …)
supabase/       migrations/ and Edge Functions (ai-coach, analyze-photo, delete-account,
                nutrition-lookup, exercise-media, apple-token-exchange, revenuecat-webhook)
modules/        widget-bridge native module
targets/        iOS widget target (@bacons/apple-targets)
__tests__/      Jest tests
```

## CI / automation (`.github/workflows`)

- **ci.yml** — on every push / PR: `tsc --noEmit`, `jest`, `npm audit`
  (critical blocks, high is informational).
- **db-backup.yml** — nightly (03:17 UTC) `supabase db dump` (schema + data),
  GPG-encrypted with `BACKUP_ENCRYPTION_KEY`, pushed to `zenova-db-backups`
  via `BACKUP_DEPLOY_KEY`. 30-day retention, pruned by filename date.

Required repo secrets: `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_DEPLOY_KEY`.

## Builds

EAS profiles in `eas.json`: `development`, `preview`, `production`,
`production-release` (forces `EXPO_PUBLIC_FORCE_PRO=false`).

```bash
eas build -p ios --profile production-release
eas submit -p ios --profile production-release
```
