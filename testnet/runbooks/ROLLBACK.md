
# Testnet Incident / Rollback Runbook

The testnet may be stopped, restarted from the same finalized state, or abandoned and relaunched under
a clearly different testnet genesis if a pre-public defect is discovered.

Never call a history rewrite a rollback.

For a live testnet:
- preserve logs, QCs, evidence and finalized checkpoint;
- use frozen SAFETY_HALT rules for consensus-safety incidents;
- do not lower QC thresholds to restore liveness;
- do not replace validators based only on partition-local inactivity;
- freeze public distribution/gateway/treasury actions during safety halt;
- if abandoning the testnet, publish the old genesis hash and final checkpoint as retired and create
  a new testnet identity/genesis explicitly.
