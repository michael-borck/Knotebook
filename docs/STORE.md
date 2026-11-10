# Pathwright packs and store

Status: first cut — static catalogue + SHA-256 install. Signing is next.

## Three artifacts

- **Pack** — `<slug>.pathwright.json`, built by Studio. Self-contained: manifest,
  compiled ink JSON, assets and cover as data URLs. Plays without a store.
- **Catalogue** — `catalogue.json`, a static list of packs with hashes and URLs.
- **Store** — static hosting (GitHub Pages / Cloudflare) of the catalogue and the
  pack files. No backend, no accounts.

## Catalogue format

```json
{
  "format": "pathwright-catalogue",
  "version": 1,
  "generated": "2026-11-10T00:00:00.000Z",
  "packs": [
    {
      "id": "the-lantern-keepers",
      "title": "The Lantern Keepers",
      "author": "Pathwright",
      "theme": "noir",
      "sha256": "…",
      "url": "sample.pathwright.json",
      "description": "Demo pack.",
      "licence": "CC BY 4.0"
    }
  ]
}
```

`url` may be relative to the catalogue or absolute.

## Building a catalogue

```bash
npm run store:build -- --dir ./packs --base https://example.com/packs/ --out ./packs/catalogue.json
```

- Scans `--dir` for `*.pathwright.json`.
- Computes SHA-256 over each file.
- Writes the catalogue.

Bundled demo:

```bash
npm run store:demo
# writes public/sample.pathwright.json and public/catalogue.json
```

## Player store

- Open **Store** in the player.
- URL resolution order: `?store=<url>` → `VITE_CATALOGUE_URL` → `./catalogue.json`.
- Install: download → **SHA-256 check** → schema validation → IndexedDB.
- Direct **Import pack** stays available for sideloading and classrooms.

## Submission model (PR, Lorekeeper-style)

Planned public repos:

```
pathwright-packs/        submission queue
  templates/submission.json
  submissions/<pack-id>/pack.pathwright.json
  submissions/<pack-id>/submission.json
  scripts/validate_pack.py (or .ts)
  .github/workflows/ci.yml

pathwright-store/        published site
  catalogue.json
  packs/*.pathwright.json
```

Flow:

1. Author builds a pack in Studio.
2. Opens a PR against `pathwright-packs` with the pack + submission metadata.
3. CI validates schema, metadata, hash, licence fields.
4. Maintainer reviews.
5. Maintainer signs the pack and rebuilds the catalogue.
6. The built site deploys to `pathwright-store`.

A merged PR is **not** live until the deploy completes. Corrections ship as a new
pack version.

## Security

- Packs are **inert data** (compiled ink + assets). No arbitrary HTML/JS.
- SHA-256 prevents corrupt or swapped downloads.
- Ed25519 signatures (next) prove publisher provenance.
- If packs ever carry HTML/JS widgets, add a sandboxed iframe like Lorekeeper.

## Who it is for

| Role | Effort | Action |
|---|---|---|
| Reader | none | Player → Store → Install |
| Teacher / student | none | Import a pack file |
| Author | low | Studio → Build pack → PR |
| Store operator | high | keys, CI, catalogue, deploy, review |
| Self-hoster | medium | host catalogue + packs, point the app at it |

## Next

1. Ed25519 signing + verification (`@noble/ed25519`).
2. Scaffold `pathwright-packs` and `pathwright-store`.
3. Update detection (catalogue version newer than installed).
