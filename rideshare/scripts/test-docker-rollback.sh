#!/usr/bin/env bash
set -euo pipefail
# Real Docker isolated rollback drill: immutable registry digests, actual
# container failure, replacement, and fail-closed readiness confirmation.
dir="$(mktemp -d)"
name="liftd-rollback-$$"
registry="liftd-registry-$$"
network="liftd-rollback-$$"
cleanup(){ docker rm -f "$name" "$registry" >/dev/null 2>&1 || true; docker network rm "$network" >/dev/null 2>&1 || true; rm -rf "$dir"; }
trap cleanup EXIT
docker network create "$network" >/dev/null
printf '{"drill":true}\n' > "$dir/config.json"
cat > "$dir/Dockerfile.previous" <<'EOF'
FROM busybox:1.36
CMD ["sh","-c","sleep 600"]
EOF
cat > "$dir/Dockerfile.candidate" <<'EOF'
FROM busybox:1.36
CMD ["sh","-c","exit 42"]
EOF
docker run -d --name "$registry" --network "$network" -p 127.0.0.1:0:5000 registry:2 >/dev/null
port="$(docker inspect "$registry" --format '{{(index (index .NetworkSettings.Ports "5000/tcp") 0).HostPort}}')"
endpoint="127.0.0.1:$port"
for version in previous candidate; do
 docker build -q -f "$dir/Dockerfile.$version" -t "$endpoint/liftd-rollback-$version:drill" "$dir" >/dev/null
 docker push "$endpoint/liftd-rollback-$version:drill" >/dev/null
 digest="$(docker image inspect "$endpoint/liftd-rollback-$version:drill" --format '{{index .RepoDigests 0}}')"
 [[ "$digest" =~ @sha256:[a-f0-9]{64}$ ]] || exit 2
 if [[ "$version" == previous ]]; then previous="$digest"; else candidate="$digest"; fi
done
cat > "$dir/ready.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
test "$(docker inspect "$LIFTD_CONTAINER_NAME" --format '{{.State.Running}}')" = "true"
test "$(docker inspect "$LIFTD_CONTAINER_NAME" --format '{{.Config.Image}}')" = "$LIFTD_ROLLBACK_PREVIOUS_IMAGE"
EOF
export LIFTD_CONTAINER_NAME="$name"
export LIFTD_DOCKER_NETWORK="$network"
export LIFTD_DEPLOY_CONFIG_PATH="$dir/config.json"
export LIFTD_ROLLBACK_DATABASE_URL='postgres://127.0.0.1/liftd_qualification'
export LIFTD_ROLLBACK_PREVIOUS_IMAGE="$previous"
export LIFTD_ROLLBACK_CANDIDATE_IMAGE="$candidate"
export LIFTD_ROLLBACK_CONFIG='/run/secrets/liftd.json'
export LIFTD_ROLLBACK_CONTROLLER="$PWD/rideshare/scripts/docker-rollback-controller.sh"
export LIFTD_ROLLBACK_READINESS="$dir/ready.sh"
bash rideshare/scripts/rollback-qualification.sh
test "$(docker inspect "$name" --format '{{.State.Running}}')" = "true"
test "$(docker inspect "$name" --format '{{.Config.Image}}')" = "$previous"
printf 'REAL_DOCKER_ROLLBACK_VERIFIED\n'
