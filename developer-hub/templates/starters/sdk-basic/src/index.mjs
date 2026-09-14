import { createSdk420 } from '@420/sdk';

// Supply validated DEVHUB network/catalogue objects from your app bootstrap.
export function createApp420({ network, contracts, transport }) {
  return createSdk420({ network, contracts, transport });
}
