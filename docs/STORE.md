# Knotebook packs and store

Status: first cut — static catalogue + SHA-256 install. Signing is next.

## Three artifacts

- **Pack** — `<slug>.knotebook.json`, built by Studio. Self-contained: manifest,
  compiled ink JSON, assets and cover as data URLs. Plays without a store.
- **Catalogue** — `catalogue.json`, a static list of packs with hashes and URLs.
- **Store** — static hosting (GitHub Pages / Cloudflare) of the catalogue and the
  pack files. No backend, no accounts.

## Catalogue format

```json
{
  "format": "knotebook-catalogue",
  "version": 1,
  "generated": "2026-11-10T00:00:00.000Z",
  "packs": [
    {
      "id": "the-lantern-keepers",
      "title": "The Lantern Keepers",
      "author": "Knotebook",
      "theme": "noir",
      "sha256": "…",
      "url": "sample.knotebook.json",
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

- Scans `--dir` for `*.knotebook.json`.
- Computes SHA-256 over each file.
- Writes the catalogue.

Bundled demo:

```bash
npm run store:demo
# writes public/sample.knotebook.json and public/catalogue.json
```

## Signing

Generate a keypair once:

```bash
npm run keys:generate
# keys/store-public.txt  — commit or pin in the app
# keys/store-secret.txt  — gitignored; keep offline
```

Build a signed catalogue:

```bash
npm run store:build -- \
  --dir ./packs \
  --base https://example.com/packs/ \
  --key keys/store-secret.txt \
  --out ./packs/catalogue.json
```

Each entry gets a `signature`; the catalogue gets a `publicKey`.

Player verification:

- `VITE_STORE_PUBLIC_KEY` pinned at build time → **secure mode**; unsigned or
  mismatched packs are rejected.
- Otherwise the catalogue's `publicKey` is used (trust the host).
- Neither → hash-only install, labelled "Unsigned catalogue".

Pinning the key is the secure mode: a tampered catalogue cannot swap both the
key and the signature.

## Player store

- Open **Store** in the player.
- URL resolution order: `?store=<url>` → `VITE_CATALOGUE_URL` → `./catalogue.json`.
- Install: download → **SHA-256 check** → schema validation → IndexedDB.
- Direct **Import pack** stays available for sideloading and classrooms.

## Submission model (PR, Lorekeeper-style)

Planned public repos:

```
knotebook-packs/        submission queue
  templates/submission.json
  submissions/<pack-id>/pack.knotebook.json
  submissions/<pack-id>/submission.json
  scripts/validate_pack.py (or .ts)
  .github/workflows/ci.yml

knotebook-store/        published site
  catalogue.json
  packs/*.knotebook.json
```

Flow:

1. Author builds a pack in Studio.
2. Opens a PR against `knotebook-packs` with the pack + submission metadata.
3. CI validates schema, metadata, hash, licence fields.
4. Maintainer reviews.
5. Maintainer signs the pack and rebuilds the catalogue.
6. The built site deploys to `knotebook-store`.

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
2. Scaffold `knotebook-packs` and `knotebook-store`.
3. Update detection (catalogue version newer than installed).
