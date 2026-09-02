# 420AppStore

420AppStore is the Genesis application catalogue for 420 Integrated. It gives users one place to discover, inspect and launch registered applications without turning a hosted storefront into protocol authority.

## Canonical boundary

420AppStore is contract-free at Genesis. Canonical service identity, version, implementation references and registered metadata come from 420Registry / ProtocolRegistry and chain state. Search and Explorer may provide replaceable discovery, indexing and verification projections. AppStore catalogue databases, rankings and presentation data are non-canonical and rebuildable.

A listing does not create Registry legitimacy. Delisting does not revoke a Registry entry. Featured placement, categories, reviews, ratings, screenshots, descriptions and sponsorship are presentation metadata only.

## Application detail

Where available, an application detail view should expose:

- canonical service/application identity and version;
- publisher/public Identity provenance;
- contract and implementation references;
- source/build verification evidence surfaced through Explorer;
- requested wallet permissions and capability scopes;
- high-risk actions requiring wallet confirmation;
- published audit/security evidence with source provenance;
- deprecation, compromise or malicious-application warnings;
- supported network and chain ID;
- an explicit Open in 420Wallet handoff.

## Wallet safety

420AppStore cannot sign transactions, hold keys, grant capabilities, approve token spending or bypass wallet confirmation. Deep links may communicate app/network/action context, but 420Wallet and Smart Accounts remain the authorization boundary.

## Curation and competition

420 Integrated may operate an official Genesis catalogue, but alternative clients and catalogues are permitted. Sponsored or promoted placement must be labeled. Curation may suppress an application from a particular catalogue view for safety or policy reasons, but cannot rewrite canonical chain or Registry state.

Security warnings must identify their source and distinguish facts such as deprecated versions, mismatched bytecode or published incident records from catalogue opinion.

## Privacy

Private Messenger and Commons content, encrypted Resource Protocol payloads, private Identity fields and raw Attention telemetry are outside AppStore indexing. Installation or application-launch history is not public by default.

## Failure model

AppStore unavailability cannot make registered applications unusable. Users and clients can still discover and interact through Registry, Search, Explorer, Wallet, RPC and direct contract interfaces.
