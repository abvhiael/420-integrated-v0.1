# Registry events and finality

Service publication, revision and deprecation are on-chain events. Consumers may observe them through 420Indexer, but must account for head/safe/finalized status and possible pre-finality reorgs.

Do not permanently switch a security-critical dependency based only on an unfinalized event unless the integration explicitly accepts that risk.