#!/usr/bin/env sh
set -eu

TAG="v1.17.5"
EXPECTED_COMMIT="9621c6ad10934a01b5514886fb6fbd87640b6c05"
DEST="${1:-.cache/go-ethereum}"
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
PATCHER="$ROOT/execution/patches/apply-420-systemcall.py"
PATCH_TEST="$ROOT/execution/patches/systemcall420_test.go.in"
ARTIFACT_DIR="$ROOT/artifacts/node420-release-gate"

if [ ! -d "$DEST/.git" ]; then
    mkdir -p "$(dirname "$DEST")"
    git clone https://github.com/ethereum/go-ethereum.git "$DEST"
fi

git -C "$DEST" fetch origin \
    '+refs/heads/*:refs/remotes/origin/*' \
    '+refs/tags/*:refs/tags/*' \
    --force

if git -C "$DEST" rev-parse --is-shallow-repository | grep -q true; then
    git -C "$DEST" fetch --unshallow --tags --force
fi

COMMIT="$(git -C "$DEST" rev-list -n 1 "$TAG")"
if [ "$COMMIT" != "$EXPECTED_COMMIT" ]; then
    echo "fatal: $TAG resolved to $COMMIT, expected $EXPECTED_COMMIT" >&2
    exit 3
fi

git -C "$DEST" checkout --detach "$COMMIT"
git -C "$DEST" reset --hard "$COMMIT"
git -C "$DEST" clean -fdx

ACTUAL_TAG="$(git -C "$DEST" describe --tags --exact-match)"
if [ "$ACTUAL_TAG" != "$TAG" ]; then
    echo "fatal: checkout is $ACTUAL_TAG, expected $TAG" >&2
    exit 4
fi

python3 "$PATCHER" "$DEST"
cp "$PATCH_TEST" "$DEST/core/systemcall420/systemcall_test.go"
gofmt -w "$DEST/core/systemcall420/systemcall_test.go"

mkdir -p "$ARTIFACT_DIR" "$ROOT/bin/upstream"
PATCH_DIFF="$ARTIFACT_DIR/geth-$TAG-420.patch"
# Intent-to-add makes newly generated source/test files appear in the canonical diff without staging their contents.
git -C "$DEST" add -N core/systemcall420/systemcall.go core/systemcall420/systemcall_test.go
git -C "$DEST" diff --binary -- . > "$PATCH_DIFF"
if [ ! -s "$PATCH_DIFF" ]; then
    echo "fatal: 420 patch produced no source diff" >&2
    exit 5
fi
for required in core/systemcall420/systemcall.go core/systemcall420/systemcall_test.go; do
    if ! grep -q "$required" "$PATCH_DIFF"; then
        echo "fatal: release patch evidence omitted $required" >&2
        exit 6
    fi
done
PATCH_SHA256="$(sha256sum "$PATCH_DIFF" | awk '{print $1}')"

# Execute 420 package tests, then compile every directly modified upstream package.
(
    cd "$DEST"
    go test ./core/systemcall420 -count=1
    go test ./core -run '^$' -count=1
    go test ./eth/catalyst -run '^$' -count=1
    go test ./miner -run '^$' -count=1
)

env -u GITHUB_SHA -u GITHUB_REF -u GITHUB_HEAD_REF -u GITHUB_BASE_REF \
    make -C "$DEST" geth

cp "$DEST/build/bin/geth" "$ROOT/bin/upstream/geth-$TAG-420"
BINARY_SHA256="$(sha256sum "$ROOT/bin/upstream/geth-$TAG-420" | awk '{print $1}')"

cat > "$ARTIFACT_DIR/manifest.json" <<EOF
{
  "schema": "420-node420-release-gate-v1",
  "upstream_tag": "$TAG",
  "upstream_commit": "$COMMIT",
  "patch_sha256": "$PATCH_SHA256",
  "binary_sha256": "$BINARY_SHA256",
  "patcher": "execution/patches/apply-420-systemcall.py",
  "patch_test_template": "execution/patches/systemcall420_test.go.in",
  "binary": "bin/upstream/geth-$TAG-420",
  "status": "QUALIFIED_BY_BUILD_SCRIPT"
}
EOF

printf '%s\n' "$COMMIT" > "$ROOT/execution/geth-$TAG.commit"
printf '%s\n' "$PATCH_SHA256" > "$ROOT/execution/geth-$TAG-420.patch.sha256"
printf '%s\n' "$BINARY_SHA256" > "$ROOT/execution/geth-$TAG-420.binary.sha256"

echo "node420 release gate passed"
echo "upstream=$TAG commit=$COMMIT"
echo "patch_sha256=$PATCH_SHA256"
echo "binary_sha256=$BINARY_SHA256"
