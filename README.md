# Knotebook

An LLM-friendly **studio and player** for branching stories, built on
[ink](https://www.inklestudios.com/ink/).

## Live

- **Landing** — https://knotebook.borck.education/
- **App / Player** — https://knotebook.borck.education/app/
- **Player directly** — https://knotebook.borck.education/app/?player=1
- **Store** — https://michael-borck.github.io/knotebook-store/
- **Releases** — https://github.com/michael-borck/Knotebook/releases
- **Submissions** — https://github.com/michael-borck/knotebook-packs

The source repo is public. The site is generated from `landing/` (landing page)
and the Vite build at `/app/`, then published to the public
[`knotebook-site`](https://github.com/michael-borck/knotebook-site) repo. Pushes
to `main` publish automatically via
[`.github/workflows/publish.yml`](.github/workflows/publish.yml) (an SSH deploy
key scoped to `knotebook-site`). Manual publish:

```bash
npm run deploy:site
```

Custom domain: CNAME `knotebook` → `michael-borck.github.io` (DNS-only, no proxy).

Knotebook is two apps in one codebase:

- **Knotebook Studio** — Tauri desktop app: write, compile, preview, lint,
  theme, and build self-contained packs. Includes a **knot map** (React Flow)
  with coverage, dead-end and unreachable highlighting — click a knot to jump to
  its line — and an **AI assistant** with diff review and snapshots.
- **Knotebook Player** — PWA: install packs, play offline, save progress.

Themes reuse the Swipeverse art sets (`noir`, `kingdom`, `cyberpunk`, …).

## AI assistant

The Studio's **AI** tab sends the story bible and the full script to an
OpenAI-compatible chat endpoint, then shows the returned ink as a **diff**;
nothing is applied until you click Apply.

- **Providers** — Ollama (default `gemma3:4b`) or any OpenAI-compatible endpoint.
  The API key is stored locally in the browser profile; use a limited-scope key.
- **Scope** — whole story or a single knot. A knot edit replaces only that knot
  and preserves everything else.
- **Automatic retries** — failing revisions are sent back to the model (up to 3
  attempts) with the compile/lint errors before you review the diff.
- **Snapshots** — the last 10 versions are kept per project/file; restore from
  the History section.
- **Fix errors** — sends the current compile/lint errors back to the model.
- **CORS** — Ollama must allow the app origin (`OLLAMA_ORIGINS`); OpenAI's API
  allows browser origins.

## Stack

Tauri 2 · React 19 · Vite 8 · CodeMirror 6 · inkjs · TweetNaCl.

## Releases

- **Landing + PWA** — every push to `main` publishes the landing page and the
  app/player at `/app/`.
- **Desktop** — push a tag `vX.Y.Z` (matching `package.json` and
  `src-tauri/tauri.conf.json`). `.github/workflows/release.yml` runs a preflight
  gate (typecheck, lint, smoke), then builds on `macos-15`, Ubuntu 22.04 and
  Windows. macOS is signed + notarized; Windows/Linux are unsigned. It creates a
  **draft** GitHub release.
- **Notarize check** — run the **Release desktop** workflow manually. It builds,
  signs and notarizes one macOS arch and verifies it without creating a release.

```bash
git tag -a v0.1.0 -m "Knotebook v0.1.0"
git push origin v0.1.0
```

Apple signing uses the canonical secrets from the app-hq signing runbook
(`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_TEAM_ID`, `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_CONTENT`)
through the reusable composite action in
[`.github/actions/apple-signing`](.github/actions/apple-signing/action.yml).

Auto-update is wired from **v0.1.1**: the app checks
`releases/latest/download/latest.json`, verifies signed updater artifacts, and
prompts to install and restart. The updater key is **per app** (never shared):
the public key lives in `src-tauri/tauri.conf.json`; the private key and
password are `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
secrets. Back them up — losing them breaks updates for installed apps.

## Quick start

```bash
npm install
npm run dev            # Studio at http://localhost:5173/
                       # Player at http://localhost:5173/?player=1
npm run desktop:dev    # Tauri Studio
```

## Verify

```bash
npm run build
npm run smoke
cd src-tauri && cargo check
```

## Packs and store

A **pack** is one self-contained `.knotebook.json` file: manifest, compiled ink,
assets and cover. Import it directly, or publish it through a static catalogue.

- Build a pack in Studio → **Build pack**.
- Player → **Import pack**, or → **Store** with `?store=<catalogue-url>`.
- Catalogue format, submission flow and signing: [`docs/STORE.md`](docs/STORE.md).

Demo store is generated with `npm run store:demo`.

## Docs

- [`docs/PLAN.md`](docs/PLAN.md) — architecture and roadmap.
- [`docs/STORE.md`](docs/STORE.md) — packs, catalogue, store, signing.

## Dev notes

This repo lives on an exFAT volume, so macOS creates `._*` files that break
Tauri's build. The desktop scripts work around it:

```bash
npm run clean:appledouble
npm run desktop:dev
```

`CARGO_TARGET_DIR` is pointed at local APFS by those scripts. Moving the repo to
a local APFS disk removes both workarounds.

For a local desktop **release** build (`npm run desktop:build`), export the
updater key, because `createUpdaterArtifacts` signs the update bundle:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/knotebook-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ~/.tauri/knotebook-updater.password)"
```

`tauri dev` doesn't bundle, so it doesn't need the key.

## License

TBD.
