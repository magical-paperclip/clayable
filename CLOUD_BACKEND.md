# Clayable cloud backend (Upstash Redis + Vercel)

This project persists each browser session using a **Vercel serverless function** at `/api/state` backed by **Upstash Redis** (no Supabase).

## 1) Create an Upstash Redis database

1. Go to [https://upstash.com](https://upstash.com) and sign in.
2. **Create database** → pick a region close to your Vercel region.
3. Open the database → **REST API** tab.
4. Copy:
   - **UPSTASH_REDIS_REST_URL** (looks like `https://xxxx.upstash.io`)
   - **UPSTASH_REDIS_REST_TOKEN** (the long bearer token)

## 2) Add environment variables in Vercel

In **Vercel → your project → Settings → Environment Variables**:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Redeploy after saving.

If you used Vercel’s **Storage** integration for Upstash, it may have created:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Those are also read automatically by `api/state.js` as fallbacks.

## 3) API contract (unchanged for the frontend)

- `GET /api/state?sessionId=...` → `{ state: object | null, updatedAt?: string }`
- `PUT /api/state` with JSON body `{ sessionId, state }` → `{ ok: true, updatedAt }`

## 4) Behaviour

- The browser stores a random `sessionId` in `localStorage` (`clayable:session-id`).
- Autosave debounces in `js/app.js` and writes the full session JSON to Redis.
- Keys expire after **90 days** of inactivity (TTL refreshed on each save).

## Security note

The Redis token is **secret** — keep it in Vercel env vars only, never in client code or public repos.
