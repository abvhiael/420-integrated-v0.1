
# Public Incident Communication Templates

## Investigating

We are investigating an issue affecting [components]. The last known finalized slot is [slot].
User transactions may be delayed. Do not resend transactions repeatedly unless instructed.

## Identified

The issue has been identified as [summary]. Consensus safety status is [NORMAL / DEGRADED /
SAFETY_HALT]. We are applying the documented recovery procedure.

## Monitoring

Service has been restored and we are monitoring finality, execution synchronization and RPC health.

## Resolved

The incident is resolved. Finalized history was [preserved / testnet retired and relaunched].
A postmortem will be published if the incident was MAJOR or CRITICAL.

Never claim a history rewrite is a rollback.
