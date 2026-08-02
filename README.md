# Pancake Tunes

Tunes and sets for the Sunday session, after the pancakes.

A small Next.js app for looking things up mid-session: search every tune
instantly, see what's in each set and in what order, and edit from a phone. The
repertoire lives as JSON files in this repo — GitHub is the database, and the
commit history is the backup.

## Quick start

```bash
npm install
npm run secrets -- "a password for the family"   # prints two env values
cp .env.example .env.local                       # then paste them in
npm run dev
```

Open <http://localhost:3000>. Browsing needs no password; **Sign in** unlocks
editing.

With no `GITHUB_*` variables set, the app reads and writes `./data` directly,
so you can develop offline and review changes with `git diff`.

## Deploying to Vercel

1. Push this repo to GitHub (private is fine).
2. Create a **fine-grained personal access token**
   (Settings → Developer settings → Personal access tokens → Fine-grained):
   - Repository access: **only this repository**
   - Permissions: **Contents → Read and write**
3. Import the repo on Vercel and set four environment variables:

   | Variable | Value |
   | --- | --- |
   | `EDIT_PASSWORD_HASH` | from `npm run secrets` |
   | `SESSION_SECRET` | from `npm run secrets` |
   | `GITHUB_TOKEN` | the token from step 2 |
   | `GITHUB_REPOSITORY` | `your-username/pancaketunes` |

4. Deploy. Everything fits inside the free tier.

Each edit becomes a commit, which triggers a Vercel redeploy. That is harmless
but noisy — to stop it, add a `vercel.json` with an
[ignored build step](https://vercel.com/docs/projects/overview#ignored-build-step)
that skips builds when only `data/**` changed.

## How it works

```
Browser ──▶ Server Component / Server Action ──▶ GitHub API
             (session cookie checked here)         (token stays server-side)
```

- **Reads** — one GraphQL query fetches every tune and set file at once, so a
  file-per-tune layout costs a single request. Cached in memory for 60s.
- **Writes** — the Contents API commits one file per edit, passing the file's
  git sha. If someone else saved first, GitHub rejects it and the app asks you
  to refresh instead of overwriting their work.
- **Auth** — one shared password, stored only as a scrypt hash. Signing in sets
  a signed, HTTP-only cookie. Every write re-checks it server-side.
- **Search** — runs in the browser against data embedded in the page, so
  results appear as fast as you can type.

`PLAN.md` has the full architecture, the reasoning behind each choice, and the
roadmap for the nice-to-haves (session mode, favourites, ABC rendering, PWA).

## Data

```
data/
  tunes/cooleys.json          # id = filename
  sets/pancake-openers.json   # references tunes by id
```

The filename is the id, and ids never change — renaming a tune won't break the
sets that use it. Files are validated on read (`lib/schema.ts`); anything
malformed is skipped and reported at the top of the home page rather than
crashing the site.

You can also just edit the JSON in your editor and commit — the app picks it up.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run secrets -- "pw"` | Print `EDIT_PASSWORD_HASH` and `SESSION_SECRET` |

## Layout

```
app/           Routes (browse, tune, set, editors, login)
components/    UI — the only place with "use client"
lib/
  actions.ts   Server Actions: the single write path
  data.ts      Reads, validation, caching
  search.ts    Client-side search and sorting
  schema.ts    Zod schemas — the source of truth for the data model
  auth/        Password hashing, session cookie, route guard
  storage/     GitHub adapter + local filesystem adapter
  github/      API client (never reachable from the browser)
data/          The repertoire
```
