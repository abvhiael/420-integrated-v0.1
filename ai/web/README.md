# 420AI web client

This is the user-facing 420AI browser application introduced for AI-AUDIT-8.

## Authority boundaries

- The browser uses an injected EIP-1193 wallet only for requester-authorized AIJobManager actions.
- Model/version/deployment/job/policy discovery comes from the shared 420Indexer `420-ai-read-v1` surface and is explicitly non-authoritative.
- Private input plaintext is converted locally to a commitment for the request transaction and is never persisted to localStorage, runtime configuration, public indexer fields, or calldata.
- Funding is display-only in this client. `AIJobEscrow.fund` is deliberately disabled; canonical funding is bound through Vault/settlement adapters.
- Provider credentials, private keys, API tokens and privileged secrets are forbidden in browser runtime configuration.

## Production materialization

`runtime-config.json` is intentionally fail-closed until AI-AUDIT-9 publishes the target network and read-service endpoints. The transaction feature flags remain disabled in the committed unresolved configuration. `runtime-config.example.json` documents the deployable shape.

When live deployment values are materialized, the client validates the configured chain ID at wallet connection, rejects credential-bearing URLs, simulates each requester transaction before `eth_sendTransaction`, invalidates pending review when wallet authority changes, and tracks confirmation/reorg/revert/drop states.

## Local qualification

```
cd ai/web
npm run build
```
