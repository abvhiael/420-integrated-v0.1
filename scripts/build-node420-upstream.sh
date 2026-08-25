#!/usr/bin/env sh
set -eu

TAG="v1.17.5"
DEST="${1:-.cache/go-ethereum}"

if [ ! -d "$DEST/.git" ]; then
    mkdir -p "$(dirname "$DEST")"
    git clone https://github.com/ethereum/go-ethereum.git "$DEST"
else
    echo "Refreshing existing go-ethereum checkout..."
    git -C "$DEST" fetch --all --tags --force
fi

git -C "$DEST" checkout --detach "$TAG"

COMMIT="$(git -C "$DEST" rev-list -n 1 "$TAG")"

echo "building go-ethereum $TAG at $COMMIT"

make -C "$DEST" geth

mkdir -p bin/upstream
cp "$DEST/build/bin/geth" "bin/upstream/geth-$TAG"

echo "$COMMIT" > "execution/geth-$TAG.commit"

echo "built bin/upstream/geth-$TAG"
