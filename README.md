# Knotebook

An LLM-friendly **studio and player** for branching stories, built on
[ink](https://www.inklestudios.com/ink/).

## Live

- **App / Player** — https://michael-borck.github.io/knotebook-site/
- **Player directly** — https://michael-borck.github.io/knotebook-site/?player=1
- **Store** — https://michael-borck.github.io/knotebook-store/
- **Submissions** — https://github.com/michael-borck/knotebook-packs

The app source stays private; the built site is published to the public
[`knotebook-site`](https://github.com/michael-borck/knotebook-site) repo.
Pushes to `main` publish automatically via
[`.github/workflows/publish.yml`](.github/workflows/publish.yml) (an SSH deploy
key scoped to `knotebook-site`). Manual publish:

```bash
npm run deploy:site
```

Knotebook is two apps in one codebase:

- **Knotebook Studio** — Tauri desktop app: write, compile, preview, lint,
  theme, and build self-contained packs. Includes a **knot map** (React Flow)
  with coverage, dead-end and unreachable highlighting — click a knot to jump to
  its line.
- **Knotebook Player** — PWA: install packs, play offline, save progress.

Themes reuse the Swipeverse art sets (`noir`, `kingdom`, `cyberpunk`, …).

## Stack

Tauri 2 · React 19 · Vite 8 · CodeMirror 6 · inkjs · TweetNaCl.

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

## License

TBD.
