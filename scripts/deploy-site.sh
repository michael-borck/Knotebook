#!/usr/bin/env bash
# Build the app for the public site repo and push it.
# Usage: npm run deploy:site   (or SITE_DIR=... npm run deploy:site)
set -euo pipefail

SITE_DIR="${SITE_DIR:-../knotebook-site}"
BASE="${PAGES_BASE:-/knotebook-site/}"

PAGES_BASE="$BASE" npm run build
find dist -name '._*' -delete 2>/dev/null || true

mkdir -p "$SITE_DIR"
rm -rf "$SITE_DIR/assets" "$SITE_DIR/icons"
rm -f \
  "$SITE_DIR/index.html" \
  "$SITE_DIR/manifest.webmanifest" \
  "$SITE_DIR/sw.js" \
  "$SITE_DIR/favicon.svg" \
  "$SITE_DIR/icons.svg" \
  "$SITE_DIR/catalogue.json" \
  "$SITE_DIR/sample.knotebook.json" \
  "$SITE_DIR/.nojekyll"

cp -R dist/. "$SITE_DIR/"
touch "$SITE_DIR/.nojekyll"

git -C "$SITE_DIR" add -A
git -C "$SITE_DIR" commit -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || true
git -C "$SITE_DIR" push
