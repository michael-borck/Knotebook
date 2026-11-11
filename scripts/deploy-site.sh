#!/usr/bin/env bash
# Build the landing + app and push to the public site repo.
# Usage: npm run deploy:site   (or SITE_DIR=... npm run deploy:site)
set -euo pipefail

SITE_DIR="${SITE_DIR:-../knotebook-site}"
BASE="${PAGES_BASE:-./}"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

PAGES_BASE="$BASE" npm run build
find dist -name '._*' -delete 2>/dev/null || true

mkdir -p "$BUILD/app"
cp -R landing/. "$BUILD/"
cp -R dist/. "$BUILD/app/"
touch "$BUILD/.nojekyll"

mkdir -p "$SITE_DIR"
rm -rf "$SITE_DIR/assets" "$SITE_DIR/icons" "$SITE_DIR/app"
rm -f \
  "$SITE_DIR/index.html" \
  "$SITE_DIR/manifest.webmanifest" \
  "$SITE_DIR/sw.js" \
  "$SITE_DIR/favicon.svg" \
  "$SITE_DIR/icons.svg" \
  "$SITE_DIR/catalogue.json" \
  "$SITE_DIR/sample.knotebook.json" \
  "$SITE_DIR/.nojekyll"

cp -R "$BUILD/." "$SITE_DIR/"

git -C "$SITE_DIR" add -A
git -C "$SITE_DIR" commit -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || true
git -C "$SITE_DIR" push
