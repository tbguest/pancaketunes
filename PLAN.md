# Pancake Tunes — architecture and plan

The brief asked for a plan and a working app. This is the plan; the app in this
repo implements everything through Milestone 4. Sections 1–13 describe what is
built and why. Section 14 is the roadmap, with the shipped part marked.

The guiding constraint: **this is a family jam, not a product.** Every choice
below trades scale for the ability to understand the whole system in an
afternoon and fix it a year from now.

---

## 1. Overall architecture

```
┌──────────────────────────────────────────┐
│ Browser                                  │
│  Server-rendered HTML + a little React   │
│  for search, filters and the set picker  │
└───────────────┬──────────────────────────┘
                │ HTML / Server Action POSTs
┌───────────────▼──────────────────────────┐
│ Next.js on Vercel                        │
│  app/       routes and page composition  │
│  lib/       auth · data · storage        │
└───────────────┬──────────────────────────┘
                │ REST + GraphQL, server-side only
┌───────────────▼──────────────────────────┐
│ GitHub repository                        │
│  data/tunes/*.json                       │
│  data/sets/*.json                        │
│  git history = audit trail + backup      │
└──────────────────────────────────────────┘
```

Four layers, each with one job:

| Layer | Module | Responsibility |
| --- | --- | --- |
| UI | `app/`, `components/` | Rendering and interaction only |
| Business logic | `lib/actions.ts`, `lib/data.ts`, `lib/schema.ts` | Validation, ids, orchestration |
| Storage | `lib/storage/` | Read/write records; knows nothing about tunes |
| Integration | `lib/github/` | HTTP against the GitHub API |

`lib/github/` and `lib/storage/` import `server-only`, so a stray import from a
client component fails the build rather than leaking a token.

### Why no database

The dataset is a few hundred small documents that change a handful of times a
week and are only written by people sitting in the same room. Git already
provides durability, history, diffing, and offline editing. A database would add
a service to run, a schema to migrate, and a bill to pay, in exchange for
concurrency guarantees nobody here needs.

**Where this breaks down:** roughly a few thousand tunes (the read payload gets
heavy) or genuinely concurrent editing (sha conflicts start to annoy). Both are
far beyond a family session.

---

## 2. Folder structure

```
app/
  layout.tsx                 shell, masthead, sign-in state
  page.tsx                   browse: search + tabs
  error.tsx / not-found.tsx  failure states
  login/page.tsx
  tunes/new/page.tsx
  tunes/[id]/page.tsx
  tunes/[id]/edit/page.tsx
  sets/new/page.tsx
  sets/[id]/page.tsx
  sets/[id]/edit/page.tsx

components/                  every "use client" file lives here
  Browser.tsx                search, type filters, tabs, lists
  TuneForm.tsx  SetForm.tsx  editors
  DeleteButton.tsx  LoginForm.tsx  SubmitButton.tsx  DataProblems.tsx

lib/
  types.ts     domain types and tune-type vocabulary
  schema.ts    zod schemas — the source of truth
  data.ts      read, validate, cache, resolve references
  actions.ts   Server Actions — the only write path
  search.ts    client-side search, ranking, collation
  slug.ts      id generation
  form.ts      form-field <-> data conversions
  auth/        password.ts · session.ts · actions.ts · guard.ts
  storage/     index.ts · github.ts · local.ts · types.ts
  github/      client.ts

scripts/setup-secrets.mjs    prints env values
data/tunes/*.json  data/sets/*.json
```

Flat and boring on purpose: one concept per file, and the file name says which.

---

## 3. Data models

Defined in `lib/types.ts`, validated by `lib/schema.ts`.

```ts
type Tune = {
  id: string;                // slug, == filename, never changes
  title: string;
  alternateTitles: string[];
  type: TuneType;            // reel | jig | slip jig | … | other
  key: string;               // free text: "Edorian", "G major"
  composer?: string;
  notes?: string;
  tags: string[];
  links: { label: string; url: string }[];
  abc?: string;
  sheetMusicUrl?: string;
  createdAt: string;         // ISO 8601
  updatedAt: string;
};

type TuneSet = {
  id: string;
  name: string;
  description?: string;
  tuneIds: string[];         // ordered; duplicates allowed
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
```

Decisions worth naming:

- **The filename is the id.** One source of truth, so a renamed file can never
  disagree with the id inside it. `lib/data.ts` overwrites the parsed `id` with
  the filename on every read.
- **Ids are stable slugs.** Derived from the title at creation, then frozen.
  Retitling a tune leaves every set intact. Collisions get `-2`, `-3`.
- **Sets reference tunes by id**, never by copy. A tune's details live in one
  place. Duplicate ids in a set are allowed on purpose — returning to the first
  tune at the end of a set is normal.
- **`key` is free text.** Sessions say "Ador", "A dorian" and "Amaj" and mean
  it; an enum would fight its users.
- **Extending the schema** means adding an optional field with a default to
  `lib/schema.ts`. Every existing file stays valid — no migration.

`_sha`, the git blob sha, is attached at read time and never persisted. It is
the concurrency token (§10).

---

## 4. Authentication flow

No accounts. One shared password, because the threat model is "a stranger finds
the URL", not "an adversary targets us".

```
/tunes/new ──▶ guard: no cookie? ──▶ /login?next=/tunes/new
                                       │  password
                                       ▼
                             scrypt verify against
                             EDIT_PASSWORD_HASH
                                       │ ok
                                       ▼
                        Set-Cookie: pt_session=<payload>.<hmac>
                        HttpOnly · Secure · SameSite=Lax · 30d
                                       │
                                       ▼
                              redirect to `next`
```

- **Hashing** — scrypt from `node:crypto` (no dependency). Cost parameters live
  inside the hash string, so they can be raised later without invalidating it.
  Comparison is `timingSafeEqual`. A fixed 400 ms delay blunts brute force.
- **Session** — a stateless signed cookie: `base64url(payload).HMAC-SHA256`.
  No session store, so nothing to run or clean up. Rotating `SESSION_SECRET`
  signs everyone out.
- **Enforcement** — `requireSession()` runs *inside every Server Action*.
  Server Actions are public HTTP endpoints; hiding a button is not access
  control. `requireSignedInPage()` on the editor routes is convenience only,
  and is commented as such.
- **Open-redirect guard** — `next` must start with a single `/`.

The hash uses `:` separators rather than the conventional `$`. Next expands
`$VAR` when loading `.env` files, which silently corrupts a `$`-delimited hash
in local development and makes the password appear wrong. That bug is easy to
hit and hard to diagnose; the separator avoids it entirely.

---

## 5. GitHub integration strategy

**Fine-grained PAT over a GitHub App.** A GitHub App means an app registration,
an installation, and JWT-to-installation-token exchange with expiry handling —
real code and real ceremony. A fine-grained PAT scoped to *one repository* with
*Contents: read & write* grants the same access with a single env var. The App's
advantages (per-install tokens, higher rate limits, attributable commits) buy
nothing for one private repo edited by one family. Revoking or rotating the PAT
is one click.

**Reading — one GraphQL query for everything.** A file-per-tune layout gives
lovely history but tempts an N+1: one HTTP request per tune. GraphQL collapses
it into a single round trip that returns every blob's text *and* oid:

```graphql
repository(owner: $owner, name: $repo) {
  tunes: object(expression: "main:data/tunes") {
    ... on Tree { entries { name type object { ... on Blob { oid text } } } }
  }
  sets: object(expression: "main:data/sets") { ... }
}
```

This is what makes the storage model viable: nice git history *and* one request.

**Writing — REST Contents API**, one commit per edit, with a human-readable
message (`Update tune: Cooley's`). Passing the file's `sha` is what gives us
conflict detection for free (§10).

**Rate limits** — 5,000 requests/hour authenticated. Reads are one request per
cold cache; writes are one per save. Not a consideration at this scale.

**Caching** — a module-level snapshot with a 60s TTL, invalidated immediately on
write. A warm Vercel instance serves browsing entirely from memory.

> **Known limit:** the cache is per-instance. If Vercel routes a write and a
> subsequent read to different instances, the read can be up to 60s stale, and
> an edit started from a stale page will be rejected as a conflict — which is the
> correct, safe outcome, and the message says to refresh. Acceptable for a
> handful of users in one room; if it ever grates, drop the TTL or move to
> `revalidateTag`.

**Local development** — with no `GITHUB_*` set, `lib/storage/local.ts` reads and
writes `./data` on disk, computing real git blob shas so conflict behaviour is
identical. Full offline development, and edits show up in `git diff`.

---

## 6. Server Actions (not API routes)

Every mutation is a Server Action. No REST layer, no fetch wrappers, no
client-side error plumbing — the form posts straight to a typed function.

| Action | Commits |
| --- | --- |
| `createTune` / `updateTune` / `deleteTune` | `data/tunes/<id>.json` |
| `createSet` / `updateSet` / `deleteSet` | `data/sets/<id>.json` |
| `login` / `logout` | nothing; sets or clears the cookie |

All six data actions share one shape, enforced by the `run()` wrapper in
`lib/actions.ts`:

```
authorise → parse form → validate (zod) → commit → invalidate cache → redirect
```

`run()` converts thrown errors into form state so the editor can show a message
without losing the user's typing, while re-throwing Next's redirect signal
untouched.

The only HTTP endpoints are the pages themselves. Nothing to document, version,
or secure separately.

---

## 7. Component hierarchy

Server Components by default; `"use client"` only where interaction demands it
(all of it in `components/`).

```
RootLayout                        server — masthead, session state
├── HomePage                      server — loads dataset
│   ├── DataProblems              server
│   └── Browser                   CLIENT — search, filters, tabs
│       ├── TuneList
│       └── SetList
├── TunePage                      server
│   └── DeleteButton              CLIENT — confirm + pending state
├── SetPage                       server — resolves tuneIds to tunes
├── TuneForm / SetForm            CLIENT — editors
│   └── SubmitButton              CLIENT — useFormStatus
└── LoginForm                     CLIENT
```

The whole repertoire is serialised into the browse page so search needs no
network. `withoutSha()` strips the git sha from that payload — only the editors
need it.

---

## 8. State management

No state library. Three kinds of state, three mechanisms:

| State | Where | Mechanism |
| --- | --- | --- |
| The repertoire | Server | Server Components + a cached read |
| Search, filter, tab | Client, ephemeral | `useState` + `useDeferredValue` |
| Form submission | Client, transient | `useActionState` / `useFormStatus` |

Search state is deliberately *not* in the URL: a session lookup is throwaway, and
keeping it out of the router means zero navigation per keystroke. The one
exception is `?view=sets`, used for the initial tab so links to the sets list
work.

Adding Redux/Zustand/React Query here would add a layer with nothing to do.

---

## 9. Search and filtering

Entirely client-side (`lib/search.ts`), against data already in the page:

1. **Normalise** — lowercase, strip accents and punctuation, so `Sí Beag` matches
   `si beag` and `Cooley's` matches `cooleys`.
2. **Index** — one haystack string per record. Tunes include titles, alternate
   titles, type, key, composer, notes and tags. **Sets also include the titles of
   the tunes they contain**, so "drowsy" finds *The Usual Reels*.
3. **Match** — every whitespace-separated token must appear (AND).
4. **Rank** — title prefix match, then title substring, then the rest. Typing
   `kes` puts *The Kesh* first.
5. **Filter** — tune type, as chips. Only types actually present are offered.
6. **Collate** — sorting ignores a leading "The"/"A"/"An", the way tune books and
   thesession.org do; otherwise half the repertoire files under T.

Linear scan over a few hundred records is microseconds. If it ever became slow,
swap in a prebuilt index behind the same function signature — nothing else
changes.

---

## 10. Editing workflow

```
Sign in ─▶ Edit ─▶ Form (carries id + sha) ─▶ Server Action
                                                │
                            validate ──fail──▶ error + typing preserved
                                │ ok
                            PUT with sha
                                ├─ ok ─▶ commit ─▶ invalidate ─▶ redirect
                                └─ 409/422 ─▶ "changed by someone else, refresh"
```

**Concurrency.** Every edit form carries the file's git sha. GitHub's Contents
API rejects a `PUT` whose `sha` doesn't match the current blob, so a second
editor cannot silently clobber the first. The app surfaces this as *"This item
was changed by someone else. Refresh and try again."* — no lock, no merge UI, no
lost work. The local adapter reproduces the same behaviour by comparing computed
blob shas.

**Preserving typing on failure.** React resets uncontrolled inputs to their
`defaultValue` once a form action settles, so a rejected save would wipe the
form. Failed actions therefore echo the submitted fields back in `FormState`, and
the forms bind `defaultValue` to those — the reset becomes a restore. (This was
caught in end-to-end testing, not by inspection.)

**Deleting a tune** used by sets is allowed, but the confirmation names the sets
affected, and a set that references a missing tune renders "Missing tune" rather
than a dead link. The alternative — cascading edits across sets — would destroy
data to preserve a constraint.

**List fields** (alternate titles, tags, recordings) are textareas, one item per
line, `Label | URL` for links. Fewer taps than a row builder, and it works
one-handed on a phone.

---

## 11. Error handling

| Failure | Behaviour |
| --- | --- |
| Malformed JSON in `data/` | File skipped; banner names it on the home page |
| Schema violation | Same — the app never dies over one bad file |
| Not signed in | Page redirects to login; action refuses regardless |
| Stale edit | Conflict message; typing preserved |
| Duplicate id on create | "Something with that id already exists" |
| GitHub down / rate limited | `app/error.tsx` with a retry button |
| Missing `SESSION_SECRET` | Explicit startup error naming the fix |
| Missing `EDIT_PASSWORD_HASH` | Login says so instead of failing opaquely |
| Unknown tune or set id | `not-found.tsx` |

The principle: never lose the user's work, never crash over data, and always say
what to do next.

---

## 12. Future extensibility

Each nice-to-have and where it plugs in:

| Feature | Approach | Touches |
| --- | --- | --- |
| Session Mode | Route `/session/[setId]` reusing `getResolvedSet` | 1 new route |
| Favourites | `favourite: boolean` in the schema; filter chip | schema, Browser |
| Practice status | `status: "learning" \| "solid"` optional field | schema, forms |
| Tags | Already stored; add tag chips to the filter strip | Browser |
| Recently played | `localStorage` ring buffer, rendered on the home page | 1 component |
| "Often followed by" | Derive from set adjacency — data already there | `lib/data.ts` |
| ABC rendering | `abcjs` in a client component, dynamically imported | TunePage |
| PDF preview | `<embed>` the `sheetMusicUrl` | TunePage |
| Audio playback | Embed YouTube/Spotify from `links` | TunePage |
| Offline / PWA | Manifest + service worker; reads are already static-ish | app shell |
| Keyboard shortcuts | `/` to focus search, `j`/`k` to move | Browser |
| Multiple sessions | A second data root behind the storage adapter | `lib/storage/` |

The three seams that make this cheap: **optional-with-default schema fields**
(no migrations), **the storage interface** (swap GitHub for anything), and
**server/client separation** (interactive features don't disturb data flow).

---

## 13. Libraries

Deliberately close to zero.

| Dependency | Why |
| --- | --- |
| `next`, `react`, `react-dom` | The framework |
| `zod` | Runtime validation of hand-editable files; the schema is the model |
| `server-only` | Turns an accidental token leak into a build error |
| `typescript`, `eslint` | Dev only |

**Deliberately not used:** an ORM (no database), a state library (§8), a CSS
framework (~600 lines of plain CSS with variables does the whole app and is
easier to read than utility soup), `@octokit/rest` (two `fetch` calls), a date
library (ISO strings), `bcrypt` (native build; `node:crypto` scrypt is stdlib).

Every dependency is a thing to update, audit, and eventually be broken by.

**Recommended when the time comes:** `abcjs` for notation, `next-pwa` for
offline, `@dnd-kit/core` if the set editor's ↑↓ buttons ever feel clumsy.

---

## 14. Milestones

**Shipped (Milestones 1–4):**

1. **Foundation** — types, zod schemas, storage interface, local adapter, seed
   data, the black-and-white one-column shell.
2. **Read-only** — browse, instant search, type filters, tune and set detail
   pages, `?view=sets` deep links, dark mode.
3. **Auth** — scrypt hashing, signed cookie, login/logout, route guards,
   server-side enforcement in every action.
4. **Editing** — create/edit/delete for tunes and sets, the ordered set picker,
   GitHub adapter with GraphQL reads and sha-checked writes, conflict handling,
   error states.

Verified with 27 end-to-end browser checks covering search ranking, filtering,
auth (including rejection), full CRUD, slug collisions, conflict detection,
delete warnings, dark mode, and mobile overflow.

**Next, in order of payoff per hour:**

5. **Session Mode** — `/session/[setId]`, huge type, no chrome, swipe between
   tunes. The single biggest win for actual playing.
6. **Favourites and practice status** — two optional schema fields and two filter
   chips.
7. **Recently played** — `localStorage`, no schema change.
8. **ABC rendering** — `abcjs`, dynamically imported so it costs nothing to
   anyone not looking at notation.
9. **PWA / offline** — the church hall has bad signal.
10. **Keyboard shortcuts** — for the laptop on the table.
11. **"Often followed by"** — derived from existing set data; suggests the next
    tune while editing.

Nothing in 5–11 requires touching the storage layer, the auth model, or the data
format.
