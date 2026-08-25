#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-historical-source-mirrors}"
mkdir -p "$ROOT"
cd "$ROOT"

echo "== PUFFScoin GitHub mirror =="
if [ ! -d puffscoin-github.git ]; then
  git clone --mirror https://github.com/puffscoin/go-Puffscoin.git puffscoin-github.git
else
  git -C puffscoin-github.git remote update --prune
fi

echo "== PUFFScoin Launchpad mirror =="
if [ ! -d puffscoin-launchpad.git ]; then
  git clone --mirror https://git.launchpad.net/puffscoin puffscoin-launchpad.git
else
  git -C puffscoin-launchpad.git remote update --prune
fi

echo "== WhaleCoin historical repository (best effort) =="
if [ ! -d whalecoin.git ]; then
  if ! git clone --mirror https://github.com/WhaleCoinOrg/WhaleCoin.git whalecoin.git; then
    echo "WhaleCoin GitHub clone unavailable. Preserve pkg.go.dev metadata and seek another mirror/archive." >&2
  fi
else
  git -C whalecoin.git remote update --prune || true
fi

echo "== Create portable Git bundles =="
if [ -d puffscoin-github.git ]; then
  git -C puffscoin-github.git bundle create ../puffscoin-github-all.bundle --all
fi
if [ -d puffscoin-launchpad.git ]; then
  git -C puffscoin-launchpad.git bundle create ../puffscoin-launchpad-all.bundle --all
fi
if [ -d whalecoin.git ]; then
  git -C whalecoin.git bundle create ../whalecoin-all.bundle --all
fi

echo "== Hash preserved artifacts =="
(
  cd ..
  find "$ROOT" -maxdepth 1 -type f -name '*.bundle' -print0 | sort -z | xargs -0 sha256sum
) | tee ../historical-source-sha256.txt

echo "Done."
