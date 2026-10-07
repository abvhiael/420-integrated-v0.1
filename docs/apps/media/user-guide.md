---
title: 420Media User Guide
audience:
  - user
category: how-to
status: current
version: current
---

# 420Media user guide

## What users can do

The repository-qualified web application supports:

- connect a compatible Wallet;
- validate the expected network;
- browse a cursor-paginated Media library;
- select a media asset for playback when a safe playback URL is available;
- prepare a video upload;
- send bytes to a prepared 420Storage transport endpoint;
- wait for canonical Media/Storage `READY` state;
- create, inspect, start and stop a basic livestream;
- receive explicit unavailable/loading/empty/error/pending/success states.

## Wallet and session safety

420Media never asks for a seed phrase or private key.

A production deployment must use the secure Media API composition with an expiring verified application session. The session is scoped to the expected chain, network and action capability. Session tokens are transient client credentials and must not be persisted by the Media web application.

Changing Wallet account or network invalidates the local Media action context. Reconnect before continuing.

## Upload

1. Select a `video/*` file.
2. Choose visibility.
3. Provide the Storage agreement and capacity-reservation references supplied by the qualified environment.
4. Submit **Prepare & upload**.
5. The browser computes a SHA-256 digest and submits an idempotent upload-preparation request.
6. If the service supplies a safe upload endpoint, raw bytes are sent directly to the off-chain transport.
7. 420Media waits for canonical `READY` state before reporting completion.

Transport acceptance is not the same as canonical readiness.

If preparation or transport fails, the page retains the exact retry context only in memory for that browser session. Refreshing the page intentionally discards it.

## Playback

Playback is available only when the Media service supplies a safe `playback_url`.

The application does not derive or guess a media URL from an object ID. Unsafe schemes are rejected.

## Livestreaming

A basic live session requires:

- a connected Wallet on the expected chain;
- `media.livestreaming` enabled;
- a session ID;
- protocol/direction;
- a secure endpoint;
- stream reference;
- optional opaque credential reference.

The repository security policy requires encrypted WHIP/WHEP and RTMPS control-plane endpoints. SRT remains protocol-specific. Stream keys must not be embedded in endpoint URLs.

Start/stop failures do not mean the remote stream definitely changed state. Refresh status before retrying.

## Reports and appeals

The stable secure API supports Media reports, scoped moderator decisions and appeals.

A report can identify a MediaAsset, Stream or other Media-domain target and attach an opaque evidence reference.

Moderation can hide/lock/suspend application visibility but does not transfer ownership, rewrite 420Rights records, move funds or execute Wallet actions.

Appeals preserve the prior moderation decision rather than overwriting history.

## Privacy and visibility

Public Search projection is limited to READY + PUBLIC + Rights-authorized media.

Private or restricted visibility must never be widened by Search, Notifications or the web UI.

## If something looks wrong

- wrong network: disconnect/reconnect on the expected chain;
- upload transport failed: use the in-session retry action;
- upload accepted but not READY: refresh the library after canonical Storage/Media state catches up;
- playback unavailable: the asset has no safe playback locator yet;
- livestream action failed: refresh canonical status before retrying;
- suspected abuse/rights issue: submit a Media report instead of attempting to alter ownership or payment state.
