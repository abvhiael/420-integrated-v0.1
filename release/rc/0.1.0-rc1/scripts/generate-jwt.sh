#!/usr/bin/env sh
set -eu
OUT="${1:-jwt.hex}"
if command -v openssl >/dev/null 2>&1; then
  openssl rand -hex 32 > "$OUT"
else
  od -An -N32 -tx1 /dev/urandom | tr -d ' \n' > "$OUT"
  printf '\n' >> "$OUT"
fi
chmod 600 "$OUT"
echo "wrote $OUT"
