#!/usr/bin/env sh
set -eu

TAG="v1.17.5"
DEST="${1:-.cache/go-ethereum}"

if [ ! -d "$DEST/.git" ]; then
  mkdir -p "$(dirname "$DEST")"
  git clone --filter=blob:none --branch "$TAG" --depth 1 https://github.com/ethereum/go-ethereum.git "$DEST"
else
  git -C "$DEST" fetch --depth 1 origin "refs/tags/$TAG:refs/tags/$TAG"
  git -C "$DEST" checkout --detach "$TAG"
fi

COMMIT="$(git -C "$DEST" rev-list -n 1 "$TAG")"
echo "building go-ethereum $TAG at $COMMIT"
make -C "$DEST" geth

mkdir -p bin/upstream
cp "$DEST/build/bin/geth" "bin/upstream/geth-$TAG"
echo "$COMMIT" > "execution/geth-$TAG.commit"
echo "built bin/upstream/geth-$TAG"
