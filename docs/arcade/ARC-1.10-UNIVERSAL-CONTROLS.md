# ARC-1.10 — Universal pause, resume, restart and settings interfaces

The universal controller `packages/arcade-controls/src/index.mjs` coordinates existing game adapters by exact immutable game ID and strict session state. Pause suspends input and audio before pausing the game; resume restores game state before input and audio. Restart unmounts the previous adapter and creates a *fresh* instance, never carrying old score, previous session credentials or gameplay state into a new round. Errors cleanly dispose the old game and support a controlled retry. Async generation guards prevent late factories resurrecting disposed sessions.

Settings are strictly validated: volume 0–1, mute, reduced motion and high contrast. Unknown fields, malformed types, illegal state transitions, foreign game dependencies and actions after disposal fail closed. The React `UniversalGamePanel` renders 44px-minimum buttons and keyboard-operable labeled controls with status announcements and disables illegal state operations.

The Arcade launcher still has no installed, playable game bundles. Do not enable launch, restart or resume buttons for unimplemented games. The shared UI component is provided for real runtime hosts in subsequent game implementation, not falsely attached to preview cards. Game-specific settings consumers must apply reduced-motion/high-contrast visuals and accept device accessibility testing before release.

Level 1 owner: `.github/workflows/arcade-1-10-level1.yml`. Retains Arcade adapters, score/saves and frontend regression/build. No wallet, verified score, Registry authority, live game scene or phase Level 3 acceptance is implied.
