# DoobTube — user guide

## What DoobTube is

DoobTube is the 420Integrated video application built over canonical 420Media.

Public viewing does not require a Wallet.

A Wallet is requested only when an action requires user/creator authority.

## Home and discovery

Open **Home** to browse the public feed.

Only content eligible for public presentation should appear.

Feed/search ordering is presentation, not proof of ownership, legitimacy or Rights.

## Search

Use **Search** for public media discovery.

A Search result cannot grant access to PRIVATE or UNLISTED media.

No result and Search-service failure are shown as different conditions.

## Watching video

Open a media card to view its detail page.

The detail surface shows:

- title;
- creator/controller presentation;
- Media state;
- visibility;
- provenance reference where available;
- playback availability.

Playback uses a locator supplied by the qualified service.

DoobTube does not derive playback URLs from Storage object IDs.

## Wallet connection

Connect an injected Wallet when you need an authority-bearing action.

DoobTube checks the configured chain/network.

Wrong-network state blocks mutations while public browsing remains available.

DoobTube never asks for:

- private key;
- seed phrase;
- mnemonic.

Never paste those into DoobTube.

## Creator/channel page

Creator/channel pages are presentation groupings.

They are not a second Identity system and are not proof of real-world identity.

420Identity remains optional.

## Creator library

A connected creator can open **Library** to inspect creator-authorized media state.

Possible states include loading, empty, populated, load-more and error/revalidation-required.

## Upload

The repository V1 upload workflow requires:

1. correct Wallet/network;
2. a `video/*` file;
3. PRIVATE, UNLISTED or PUBLIC visibility;
4. Storage agreement/capacity references;
5. SHA-256 preparation;
6. idempotent Media upload preparation;
7. qualified upload transport;
8. canonical Media state revalidation.

Uploading bytes does **not** mean the media is READY.

DoobTube shows success only after canonical readiness is confirmed.

## Livestream

The Live surface supports:

- create;
- status refresh;
- start;
- stop.

Livestream authority remains bound to the canonical controller.

If start/stop is uncertain or fails, refresh canonical status before retrying.

Do not put stream credentials into public URLs.

## Subscriptions

Creator-update subscriptions are:

- opt-in;
- reversible at the owning service;
- free in V1;
- not paid access entitlement;
- separate from promotional consent.

## Reports and appeals

You can report eligible content through the moderation surface.

A report does not itself delete, transfer or rewrite media ownership/Rights.

Appeals preserve prior decision history.

Moderators have app-scoped Media authority only.

## Sharing

DoobTube shares application references.

Sharing a PRIVATE item is not treated as an access grant.

## Delete/export

The current repository-qualified Media API does not expose a DoobTube-qualified delete/export endpoint.

The Data surface therefore reports those operations unavailable rather than fabricating success.

Immutable/canonical protocol history may remain even if a future owning service supports logical deletion.

## Accessibility

The web application includes:

- semantic navigation;
- labelled forms;
- keyboard-native controls;
- visible focus;
- status/alert announcements;
- native video controls;
- reduced-motion support;
- responsive layouts.

## Safety and privacy

DoobTube is non-custodial.

Remember:

- public Search/feed is derived;
- Identity is optional;
- Wallet signing remains in your Wallet;
- public visibility depends on canonical Media/Rights state;
- notifications do not gain Wallet authority;
- moderation is not protocol ownership authority.

## Current release status

The repository application is **not** testnet-ready, Genesis-ready or production-ready merely because local build/tests pass.

Production-equivalent qualification is a later roadmap phase.
