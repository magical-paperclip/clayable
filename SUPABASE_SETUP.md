# Clayable Cloud Persistence Setup (Supabase + Vercel)

This adds autosave + restore for each browser session.

## 1) Create table in Supabase

Run this in the Supabase SQL editor:

```sql
create table if not exists public.clayable_sessions (
  session_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- optional index if you query by updated_at for admin views
create index if not exists clayable_sessions_updated_at_idx
  on public.clayable_sessions (updated_at desc);
```

## 2) Set Vercel environment variables

In your Vercel project settings, add:

- `SUPABASE_URL` (example: `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` (service role secret from Supabase)

These are used by `api/state.js`.

## 3) Deploy

Push to `main` (or your deploy branch). Vercel will deploy the API route:

- `GET /api/state?sessionId=...`
- `PUT /api/state`

## Behavior

- Frontend generates/stores a session ID in localStorage (`clayable:session-id`).
- On load, Clayable restores the previous state for that session.
- Autosave runs with debounce while sculpting/changing controls.
- Toasts are shown on load failure or autosave failure.

