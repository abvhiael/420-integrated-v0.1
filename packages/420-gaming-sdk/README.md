# @420/gaming-sdk

Game-neutral client helpers for integrating 420 ecosystem games with the shared 420 Gaming Protocol.

This package intentionally contains policy and adapter boundaries, not private-key custody or game mechanics.

## Example

```js
import { AccessRequirement, createGamingClient420 } from "./src/index.js";

const gaming = createGamingClient420({
  gameId: "your-canonical-game-id",
  adapters: {
    getProfile: async ({ gameId, account }) => ({ gameId, account })
  }
});

const decision = gaming.canAccess({
  requirement: AccessRequirement.CORE,
  registered: false,
  walletLinked: false,
  walletConnected: false
});
```

See `docs/gaming/420GP-7-SHARED-SDK.md` for the protocol integration boundary.
