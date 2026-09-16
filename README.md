# Socializer

AI finds it. You swipe. It gets posted.

Socializer is a multi-tenant SaaS: each user tells it what they care about, an AI
researcher gathers fresh candidates from the web and social sites every morning and
drafts a post in the user's voice, and the user swipes **right to post** or **left to
skip**. Approved candidates go straight out to the platforms the user connected.
X is the first platform.

## The two things a user sees

| Tab | What it is | Gear (settings) |
|-----|------------|-----------------|
| **In** | Post candidates coming in: the swipe deck | Interests, allowed sources, posting voice, cards per day |
| **Out** | Posts that went out (and what was skipped) | Platform connections (X), pause/resume posting |

Billing lives under the account menu in the header.

## Plans

| | Free | Pro |
|--|--|--|
| Platforms | X only | Every platform Socializer supports, as each one ships |
| Candidates per day | `SOCIALIZER_FREE_DAILY_CARDS` (default 5) | `SOCIALIZER_PRO_DAILY_CARDS` (default 40) |
| Price | $0 | Your Stripe price |

Plan rules live in `src/lib/plans.ts` and `src/lib/entitlements.ts`. When Stripe is not
configured (local dev, self-hosting) everyone is treated as Pro.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase**: Postgres, Auth (email/password + magic link), Row Level Security
- **Anthropic Claude** (`claude-opus-5` by default) with the server-side `web_search` tool for discovery and structured outputs for extraction
- **X API v2** with OAuth 2.0 + PKCE (`tweet.write`, `offline.access`)
- **Stripe** subscriptions: a **Free** tier that posts to X only, and **Pro** for every platform
- **GitHub Actions** for the daily gather (and on-demand runs), hosted UI on **Netlify**

## Local setup

1. **Install**
   ```bash
   npm install
   cp .env.example .env.local
   ```

2. **Supabase**
   - Create a **dedicated** project for Socializer. Auth users are shared across a
     Supabase project, so reusing a project from another app would merge their users.
   - Copy the URL, anon key and service-role key into `.env.local`.
   - Run the schema: paste `supabase/migrations/0001_init.sql` into the SQL editor,
     or `supabase db push` with the CLI. `supabase/rollback_0001.sql` undoes it.
   - Auth → URL configuration: set Site URL to your app URL and add
     `{APP_URL}/auth/callback` to Redirect URLs.

3. **Anthropic**: create an API key at console.anthropic.com and set `ANTHROPIC_API_KEY`.

4. **X developer app** (developer.x.com)
   - Create a project + app, enable **User authentication settings**.
   - App permissions: *Read and write*. Type of app: *Web App, Automated App or Bot*.
   - Callback URL: `{APP_URL}/api/x/callback`. Website URL: `{APP_URL}`.
   - Copy the OAuth 2.0 Client ID and Client Secret into `.env.local`.

5. **Stripe** (optional locally; the app runs with billing disabled if unset)
   - Create a recurring monthly Price and set `STRIPE_PRICE_ID`.
   - Webhook endpoint `{APP_URL}/api/stripe/webhook` with events
     `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`.
     For local dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

6. **Secrets**
   ```bash
   openssl rand -base64 32   # -> TOKEN_ENCRYPTION_KEY (encrypts X tokens at rest)
   openssl rand -hex 32      # -> CRON_SECRET
   ```

7. **Run**
   ```bash
   npm run dev
   ```
   Sign up, add an interest under **In → ⚙**, connect X under **Out → ⚙**, then press
   **Gather now** on the In tab (or wait for the morning cron).

## Deploy to Netlify

1. netlify.com → **Add new site** → **Import an existing project** → GitHub → `socializer`.
   Build command `npm run build`, publish directory `.next` (both in `netlify.toml`).
2. Site configuration → **Environment variables**: add every variable from `.env.example`
   except `CRON_SECRET` (optional). Set `NEXT_PUBLIC_APP_URL` to the Netlify URL.
3. Deploy. Then add `{NETLIFY_URL}/auth/callback` to Supabase → Authentication →
   URL Configuration, and use the Netlify URL for the X callback and Stripe webhook.

### Daily gather (GitHub Actions)

Discovery runs longer than Netlify's function timeout, so it runs in GitHub Actions:
`.github/workflows/gather.yml` runs daily at 06:00 UTC and on demand.

1. Repo → Settings → Secrets and variables → Actions → **Secrets**: add
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY`, and (if billing is on) `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`.
2. To make the in-app **Gather now** button trigger the workflow, create a fine-grained
   personal access token (GitHub → Settings → Developer settings) scoped to this repo with
   **Actions: Read and write**, and set `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY`
   and `GITHUB_DISPATCH_REF` in Netlify. Without them the button runs discovery inline,
   which works on hosts that allow long requests.
3. Actions tab → **Gather content** → **Run workflow** runs it by hand.

`GET /api/cron/gather` (with `Authorization: Bearer $CRON_SECRET`) still exists for any
external cron service on a host with long-running functions.

## How a day works

1. **The daily workflow** runs `scripts/gather.ts`, which calls `gatherForUser` for every
   user with an active interest. It only tops the queue up to the user's *cards per day*.
2. **Discovery** (`src/lib/ai/discover.ts`) makes two Claude calls: one research pass
   with `web_search` that produces a digest, and one extraction pass with structured
   outputs that turns the digest into typed candidates. Recently seen URLs are excluded.
3. **Swipe** (`/app/in`): right calls `POST /api/items/:id/decide` with `post`, which
   refreshes the X token if needed and publishes immediately; left marks it skipped.
   Users can edit the draft before posting. Keyboard: ← skip, → post, E edit.
4. **Out** (`/app/out`) lists every decision with a link to the live post or the error.

## Security notes

- All tables have RLS; users only ever see their own rows.
- Encrypted X tokens are not readable by the browser client at all (column-level grants);
  only server code with the service-role key can decrypt them.
- OAuth `state` and PKCE verifier are kept in short-lived `httpOnly` cookies.
- The cron endpoint requires `CRON_SECRET`; the Stripe webhook verifies signatures;
  "Gather now" only ever dispatches a workflow for the signed-in user's own id.

## Roadmap

- More platforms behind the same `platform_connections` table: Facebook Pages, Instagram
  (needs a generated image), Threads, LinkedIn, Bluesky, Mastodon, Reddit, Pinterest, TikTok,
  YouTube Community. The roster lives in `src/lib/plans.ts`.
- Scheduling approved posts instead of posting instantly
- Per-interest scheduling and per-platform voice
- Team workspaces
