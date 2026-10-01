# 420 Identity user guide

420 Identity is an **optional pseudonymous profile and credential system**. It does not prove legal identity, wallet ownership, universal reputation or authorization.

The canonical Wallet workflow is hosted inside 420 Wallet. It binds to the configured Identity420 deployment and refuses write operations until the connected chain, deployed code, contract identity and protocol version are verified.

## Profiles

A profile contains:

- a profile ID;
- current controller;
- pending controller;
- public metadata commitment;
- optional primary `.420` label hash;
- creation/update timestamps;
- active/inactive state.

The Wallet lets the controller:

- create a profile;
- update the metadata commitment;
- activate or deactivate the profile;
- nominate a replacement controller.

Controller transfer is two-step. The current controller nominates a new address; the nominated address must separately accept before control changes.

Metadata commitments are public hashes. Do not put private personal data directly on-chain.

## Primary .420 name

A strong Identity/Names binding requires **both** contracts to agree:

1. Names420 must say the active name record claims the profile ID; and
2. Identity420 must point the profile's `primaryName` to the same label hash.

The Wallet checks the Names420 side before allowing a new Identity primary-name pointer and labels a name as verified only when both directions agree.

Clearing the Identity pointer does not mutate Names420. Changing the Names420 profile link likewise does not automatically change Identity420. Re-check both directions after either contract changes.

## Credentials

The Wallet can inspect a credential by credential ID and shows:

- subject profile;
- issuer ID;
- credential type;
- public claim commitment;
- current validity;
- current issuer trust class and issuer activity.

Credential validity is dynamic. A credential must exist, be unrevoked, unexpired, not subject-rejected, have an active issuer and reference an active subject profile.

Issuer trust classes are `COMMUNITY`, `VERIFIED`, `INSTITUTIONAL` and `SYSTEM`; they classify issuer policy, not the universal truth of every claim.

The current controller of the subject profile may reject a credential. **Subject rejection is irreversible in the current Identity420 protocol.** The Wallet warns before submitting that transaction.

## Transaction safety and recovery

Identity writes are:

1. revalidated against the connected account and current contract state;
2. simulated with `eth_call`;
3. gas-estimated;
4. revalidated again;
5. submitted only after explicit wallet approval;
6. considered complete only after a successful transaction receipt.

If the wallet account or chain changes, reconnect and reload canonical Identity state before retrying.

If a write is blocked, do not bypass controller, pending-controller, subject, bilateral-name or deployment checks. Correct the canonical state or switch back to the qualified network/account first.
