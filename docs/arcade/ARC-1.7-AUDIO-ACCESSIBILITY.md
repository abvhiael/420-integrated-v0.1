# ARC-1.7 — Audio playback, volume, mute and accessibility controls

A browser Web Audio implementation at `packages/arcade-audio/src/index.mjs` supports three synthesized approved cues with exact game scope and no network dependence. Sound starts muted and cannot activate without an explicit user gesture. Volume is bounded from 0 to 1, mute/pause/zero-volume stop active playback, and disposal closes the audio context. Concurrent voices are bounded, unknown cues and foreign game IDs fail closed.

The accessibility page contains a React control panel with labeled volume slider, explicit Enable sound control, mute/unmute and cue test. A visual/status text cue is emitted regardless of mute, unavailable hardware or paused playback. Controls are keyboard reachable and have visible focus; sound does not replace visual feedback. This is an audio subsystem, not an assertion that game content or final device WCAG acceptance has passed.

The app uses a colocated TypeScript declaration for its adapter import. No remote assets, autoplay, signer, economic rewards or score authority is introduced. Hardware/browser assistive-tech testing and per-game audio content remain for later steps. Scoped Level 1 covers adverse audio tests, existing Arcade adapters, UI accessibility rendering, app lint/typecheck and production build.
