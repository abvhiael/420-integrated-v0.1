#!/usr/bin/env bash
set -euo pipefail
: "${LIFTD_CONTAINER_NAME:?container name required}"
: "${LIFTD_DOCKER_NETWORK:?private Docker network required}"
: "${LIFTD_DEPLOY_CONFIG_PATH:?managed config source required}"
[[ "${LIFTD_CONTAINER_NAME}" =~ ^liftd-[a-z0-9-]{1,48}$ ]] || exit 2
[[ "${LIFTD_DOCKER_NETWORK}" =~ ^liftd-[a-z0-9-]{1,48}$ ]] || exit 2
[[ -f "${LIFTD_DEPLOY_CONFIG_PATH}" ]] || exit 2
case "${1:-}" in
 stop)
   docker rm -f "${LIFTD_CONTAINER_NAME}" >/dev/null 2>&1 || true
   ;;
 deploy)
   image="${2:-}"
   [[ "$image" =~ ^[A-Za-z0-9._:/-]+@sha256:[a-f0-9]{64}$ ]] || exit 2
   docker image inspect "$image" >/dev/null
   docker run -d --name "${LIFTD_CONTAINER_NAME}" --network "${LIFTD_DOCKER_NETWORK}" \
      --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 \
      --memory 256m --cpus 1 --user 1000:1000 \
      -e LIFTD_DEPLOY_CONFIG_FILE=/run/secrets/liftd.json \
      --mount "type=bind,src=${LIFTD_DEPLOY_CONFIG_PATH},dst=/run/secrets/liftd.json,readonly" \
      "$image" >/dev/null
   ;;
 *) exit 2;;
esac
