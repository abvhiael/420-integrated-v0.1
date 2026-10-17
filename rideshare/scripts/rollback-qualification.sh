#!/usr/bin/env bash
set -euo pipefail
# Offline/isolated qualification only. Never reaches a public passenger endpoint.
: "${LIFTD_ROLLBACK_DATABASE_URL:?isolated database required}"
: "${LIFTD_ROLLBACK_PREVIOUS_IMAGE:?previous digest pinned image required}"
: "${LIFTD_ROLLBACK_CANDIDATE_IMAGE:?candidate digest pinned image required}"
: "${LIFTD_ROLLBACK_CONFIG:?runtime config path required}"
if [[ ! "${LIFTD_ROLLBACK_PREVIOUS_IMAGE}" =~ ^[A-Za-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]] ||
   [[ ! "${LIFTD_ROLLBACK_CANDIDATE_IMAGE}" =~ ^[A-Za-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]; then
  echo 'ROLLBACK_IMAGE_DIGEST_REQUIRED' >&2; exit 2
fi
if [[ ! "${LIFTD_ROLLBACK_CONFIG}" == /run/secrets/* ]]; then
  echo 'ROLLBACK_MANAGED_CONFIG_REQUIRED' >&2; exit 2
fi
if [[ "${LIFTD_ROLLBACK_DATABASE_URL}" != *'/liftd_qualification'* ]]; then
  echo 'ROLLBACK_ISOLATED_DATABASE_REQUIRED' >&2; exit 2
fi
# No automatic schema down-migration or deletion. Caller must provide an
# independently approved deployment controller; this script validates its actions.
: "${LIFTD_ROLLBACK_CONTROLLER:?verified deployment controller required}"
: "${LIFTD_ROLLBACK_READINESS:?readiness verifier required}"
"${LIFTD_ROLLBACK_CONTROLLER}" stop
"${LIFTD_ROLLBACK_CONTROLLER}" deploy "${LIFTD_ROLLBACK_CANDIDATE_IMAGE}"
if "${LIFTD_ROLLBACK_READINESS}" ; then
  echo 'CANDIDATE_READY'
  exit 0
fi
echo 'CANDIDATE_UNREADY_ROLLING_BACK' >&2
"${LIFTD_ROLLBACK_CONTROLLER}" stop
"${LIFTD_ROLLBACK_CONTROLLER}" deploy "${LIFTD_ROLLBACK_PREVIOUS_IMAGE}"
if ! "${LIFTD_ROLLBACK_READINESS}"; then
  "${LIFTD_ROLLBACK_CONTROLLER}" stop
  echo 'ROLLBACK_UNREADY_TRAFFIC_DISABLED' >&2
  exit 1
fi
echo 'ROLLBACK_READY_PREVIOUS_IMAGE'
