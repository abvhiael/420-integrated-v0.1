# Bong Goggles BG-16.4 — games + messaging emitters

BG-16.4 adds production notification candidates for the canonical Bong Goggles social-game registry and the canonical 420Messenger envelope registry while preserving the authority, privacy and zero-wager boundaries established by BG-15, BG-14 and BG-16.1.

## Canonical game sources

The notification pipeline consumes only canonical events already emitted by `BongGogglesGameSessionRegistry420`:

- `GameInvited` -> `GAME_INVITE` to the invite recipient;
- `GameAccepted` -> `GAME_INVITE_ACCEPTED` to the inviter / player A;
- `GameMoveCommitted` -> `GAME_TURN` to the other canonical session player;
- `GameFinished` -> `GAME_FINISHED` to the other canonical session player.

Every game candidate requires canonical session hydration plus current notification-policy hydration. The pair must still be active, unblocked and unmuted. Game notification state must explicitly preserve the Bong Goggles zero-wager boundary. The notification layer never creates wager state, escrow state, settlement state or 420Bet authority.

`GameMoveCommitted` notifications deliberately exclude the move commitment from notification metadata. The turn-ready presentation contains only the session identifier and move-number metadata required to send the recipient back to the canonical game surface.

## Messenger source and privacy boundary

Message-received presentation is sourced from canonical 420Messenger `EnvelopeCommitted` events. A candidate is emitted only when the envelope's Messenger conversation is bound to a current, open Bong Goggles direct context and current BG-14/Bong Goggles send authorization remains valid.

The recipient is derived from the canonical direct-context participant pair rather than from notification-owned state.

`MESSAGE_RECEIVED` metadata is restricted to:

- canonical message ID;
- canonical Messenger conversation ID;
- Bong Goggles direct-context ID;
- sender sequence number.

The notification candidate never copies `envelopeHash`, `storageRefHash`, plaintext, ciphertext, payload, message body, content, device-key commitments or epoch commitments. The notification catalog now rejects forbidden private fields if they are introduced into `MESSAGE_RECEIVED` metadata.

420Notifications remains presentation-only and non-authoritative. It does not gain access to encrypted message contents, transport payloads, decryption keys, session capabilities or canonical message authorization.

## Replay and failure behavior

Games and Messenger events use the same deterministic notification ID, provenance, self-suppression, snapshot/restart and replay-deduplication machinery established in BG-12.6 and hardened in BG-16.1 through BG-16.3.
