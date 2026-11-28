# A5.2 — Node administration authority

Preserve the existing authority model; no ABI or storage changes. Provider ownership, node ownership and delegated grants are separate. A grant must match the exact Resource action and scopeNode(stored providerId,nodeId). No provider-wide authority follows from node ownership or a node-scoped grant.

| Operation | Provider operator | Stored node operator alone | Delegate |
|---|---|---|---|
| Register node | Yes | No | Registration grant plus exact provider consent |
| Set/revoke registration consent | Yes | No | No |
| Activate, suspend, retire | Yes | Own node only | Exact SET_NODE_STATE grant |
| Update endpoint and capacity | Yes | Own node only | Exact UPDATE_NODE grant |
| Publish offer | Yes | No | Exact PUBLISH_OFFER grant |
| Submit receipt | No automatic authority | Own node only | Exact SUBMIT_RECEIPT grant |
| Provider administration | Own provider, subject to existing rules | No automatic authority | Separate provider-scoped authorization where supported |

Where the same account occupies both roles, the union of its independently held authorities applies. Updates are allowed only while registered or suspended, with nonzero commitments. Activation requires an eligible provider; retirement is terminal. Offer publication additionally requires an active node/provider/service and valid policy limits. Receipt submission requires a valid open session, canonical receipt ID and monotonically increasing bounded usage; existing session discharge semantics are unchanged. No lifecycle authority grants commercial publication or receipt authority by implication. Existing A5.1 tests cover registration consent and payload binding; A5.2 adds separate-actor tests for provider isolation, sibling and foreign-node denial, lifecycle, grant action and scope, revocation, offer and receipt boundaries.

Qualification must be confirmed against the exact committed HEAD. A6 offer identity and economic grant limits remain separate findings.
