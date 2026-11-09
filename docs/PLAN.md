# Pathwright — build plan

Status: **Phase 0 complete** (editor spike verified). Last updated: 2026-11-09.

## Product

An **LLM-friendly studio for general branching stories**, with a real distribution
channel (packs + store). Not another general ink IDE.

## Principles

- **ink is the source of truth.** Compile and run in-browser with `inkjs`; no
  native compiler binary and no Python build step.
- **Studio vs Player.** Tauri desktop app for authoring; PWA for reading. One
  pack format, no forks.
- **Themes are shared.** Reuse the 21 art sets already in
  `swipeverse-store/art` (noir, kingdom, cyberpunk, …).
- **Safe by default.** Packs are inert data (compiled ink + assets). No arbitrary
  HTML/JS in packs.
- **No backend** until a paid-pack need is proven. Static catalogue + GitHub
  Pages, like `swipeverse-store` and `lorekeeper-packs`.

## Architecture

```
core        compile, lint, bible, pack, theme (shared, no UI)
studio      Tauri + React + CodeMirror 6 + inkjs  (authoring)
player      PWA that installs packs and plays offline
store       static catalogue + signing (separate repo)
themes      theme registry derived from swipeverse-store/art
```

Today everything lives in one Vite app. Split into `packages/core` /
`apps/studio` / `apps/player` when the player lands (Phase 2).

## Repo layout (current)

```
src/                 React app (studio)
  lib/ink.ts         compile + play
  lib/lint.ts        conventions + word count
  lib/bible.ts       story bible + LLM prompt
  lib/exportHtml.ts  standalone HTML reader
  lib/inkRuntime.ts  inlined inkjs runtime for export
  lib/platform.ts    Tauri vs browser file I/O
  samples/story.ink  demo story
src-tauri/           Tauri 2 shell + read/write commands
scripts/smoke.ts     compile/play/lint/export smoke test
docs/PLAN.md         this file
```

## Roadmap

### Phase 0 — editor spike (done)
Tauri shell, CodeMirror ink editor, in-browser compile, live preview, issue
list, story bible, LLM prompt, standalone HTML export, smoke test.

**Verified:** `npm run build`, `npm run smoke`, `cargo check`, dev server 200.

### Phase 1 — real Studio core (next)
- Project folder: open folder, file tree with `INCLUDE`, asset folder.
- Autosave + timestamped backups under `.pathwright/backups/`.
- `pathwright.bible.json` stored in the project.
- Theme registry + picker; preview and export follow the theme.
- Click an issue to jump to its line.
- Shortcuts: save, open, export.

Exit: author a multi-file story, theme it, export it, reopen it.

### Phase 1.5 — structure view
React Flow knot graph (InkVisual model), coverage, dead-end/unreachable
highlighting.

### Phase 2 — pack + player
Freeze `pack.json` + theme schema. Studio builds a pack. PWA player installs to
IndexedDB, plays offline, saves progress, renders themes.

Exit: install a pack, play offline, progress survives reload.

### Phase 3 — store + signing
Static catalogue, CI validation, sha256 + Ed25519 signature,
`pathwright-packs` submission repo, `pathwright-store` site, theme filters.

Exit: third-party PR → reviewed → signed → installable.

### Phase 4 — LLM loop (differentiator)
Bible + conventions as the generation contract; per-knot structured edits with
diff review; compile/lint auto-retry; snapshots/rollback. BYO keys, optional
local Ollama.

### Phase 5 — publish + export
PWA build, Tauri release matrix, auto-update. Then H5P / ChoiceScript / Twine
exporters for a constrained subset.

### Phase 6 — polish
Icon, signing/notarization, GitHub Actions release workflow, docs,
accessibility.

## Decisions

| Decision | Choice |
|---|---|
| Repo layout | App monorepo; separate `pathwright-packs` + `pathwright-store` content repos |
| Player tech | Share core; one React codebase for now |
| Theme IDs | Canonical `kingdom`; alias `mystical → kingdom`; keep `base` |
| Signing | Ed25519 + sha256 from Phase 3 |
| LLM | BYO key; Tauri keychain, PWA localStorage; Ollama; diff-based edits |
| Accounts / backend | None until proven |
| Export formats | Defer until the pack loop is smooth |

## Themes

Source of truth: `retroverse/swipeverse-store/art/index.json`.

- Sets: aviation, business, cybersecurity, egypt, gothic, kingdom, medical,
  military, mythology, nautical, noir, pirate, postapoc, prehistoric, samurai,
  science, sport, steampunk, underwater, university, viking, western (+ base).
- Paths: `art/<set>/<archetype>.webp`, `art/<set>/back.webp`,
  `art/<set>/badges/<slot>.webp`.
- Archetypes: crisis, opportunity, judgement, faction, advisor, petitioner,
  gamble, chain, terminal.

## Draft pack format

```
pack.json
  id, version, title, author, licence, tags, level, pitch, cover, theme
  compatibility: { ink: "2.4.0", player: ">=1.0" }
  stories: [ { id, title, path, start } ]
  sha256, signature
stories/*.json     compiled ink
assets/*           images, audio
```

## Dev notes

- The repo is on an **exFAT** volume, so macOS creates AppleDouble `._*` files.
  Cargo/Tauri build scripts choke on them. Before desktop builds:
  `npm run clean:appledouble`.
- Cargo's `target/` must be on APFS: the desktop scripts set
  `CARGO_TARGET_DIR=$HOME/Library/Caches/pathwright-target`.
- **Strong recommendation:** move the repo to local APFS; that removes both
  workarounds.
- Commands: `npm run dev`, `npm run build`, `npm run smoke`,
  `npm run desktop:dev`, `npm run desktop:build`.

## Verification (Phase 0)

- `npm run build` — typecheck + bundle passes.
- `npm run smoke` — compile, play, lint, export round-trip.
- `cargo check` — Tauri shell builds.
- `npm run dev` — server responds 200 with the Pathwright page.
