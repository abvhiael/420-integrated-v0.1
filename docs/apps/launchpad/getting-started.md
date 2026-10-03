# Getting started with 420 Launchpad

420 Launchpad now has a repository-qualified browser application and service layer. Before participating, confirm the selected network, Wallet account, project controller, payment asset, sale terms and canonical identifiers shown in the campaign detail.

Typical participant flow:

1. open the Launchpad application and wait for canonical runtime resolution;
2. browse the provenance-preserving campaign discovery view;
3. open a campaign and verify its canonical identifiers and terms;
4. connect an injected wallet on the resolved chain;
5. for contributions, obtain a settled canonical 420Pay payment ID and prepare the Launchpad contribution;
6. review the exact transaction target, calldata and value before signing;
7. for successful campaigns, review claim status and supply the delivery commitment when eligible;
8. for failed/cancelled campaigns, prepare the refund batch first, then record the resulting refund commitment;
9. verify canonical chain state before treating any action as complete or retrying.

Creator management remains bounded by the contracts: project registration and sale lifecycle are governance-only. The creator UI prepares governance requests rather than pretending to grant direct lifecycle authority.

If the network, Registry resolution, service provenance or transaction review cannot be verified, the application remains fail-closed.

Never disclose recovery material or signing secrets to a project, operator or support channel.
