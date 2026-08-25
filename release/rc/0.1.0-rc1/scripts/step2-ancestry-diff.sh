#!/usr/bin/env bash
set -euo pipefail

# Run after Step-1 mirror acquisition.
# Usage: ./scripts/step2-ancestry-diff.sh /path/to/historical-source-mirrors

ROOT="${1:?supply historical mirror directory}"
OUT="${2:-historical/archaeology/git-diffs}"
mkdir -p "$OUT"

PUFFS="$ROOT/puffscoin-github.git"
WHALE="$ROOT/whalecoin.git"

if [ -d "$PUFFS" ]; then
  git --git-dir="$PUFFS" log --all --oneline --decorate > "$OUT/puffs-all-commits.txt"
  git --git-dir="$PUFFS" log --all -S'AccumulateNewRewards' --oneline -p > "$OUT/puffs-pickaxe-AccumulateNewRewards.patch" || true
  git --git-dir="$PUFFS" log --all -S'FrontierBlockReward' --oneline -p > "$OUT/puffs-pickaxe-blockreward.patch" || true
  git --git-dir="$PUFFS" log --all -G'[Ww]hale|[Ff]ollower|[Dd]eveloper' --oneline -p > "$OUT/puffs-social-reward-history.patch" || true
fi

if [ -d "$WHALE" ]; then
  git --git-dir="$WHALE" log --all --oneline --decorate > "$OUT/whale-all-commits.txt"
  git --git-dir="$WHALE" log --all -S'AccumulateNewRewards' --oneline -p > "$OUT/whale-pickaxe-AccumulateNewRewards.patch" || true
fi

# If both repositories contain a shared object ancestry, merge-base will reveal it.
if [ -d "$PUFFS" ] && [ -d "$WHALE" ]; then
  PHEAD=$(git --git-dir="$PUFFS" rev-parse refs/heads/master 2>/dev/null || true)
  WHEAD=$(git --git-dir="$WHALE" rev-parse refs/heads/master 2>/dev/null || true)
  {
    echo "PUFFS head: $PHEAD"
    echo "Whale head: $WHEAD"
    echo
    echo "Direct object merge-base cannot be calculated across separate object DBs without alternates/fetch."
    echo "Recommended: clone PUFFS working repo, add Whale mirror as remote, fetch, then run:"
    echo "git merge-base PUFFS_HEAD WHALE_HEAD"
    echo "git diff --stat WHALE_HEAD..PUFFS_HEAD"
    echo "git diff WHALE_HEAD..PUFFS_HEAD -- consensus core params eth miner cmd"
  } > "$OUT/ancestry-instructions.txt"
fi

echo "Forensic outputs written to $OUT"
