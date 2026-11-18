# API

Catalogue APIs may expose listings, metadata, categories, ranking, reviews and launch descriptors. Responses should retain canonical Registry/service references and network identity. Treat catalogue data as replaceable presentation state.

## Curated Genesis discovery

`GET /v1/apps/curated` returns a read-only list of Genesis-approved product
descriptions. Use `q` to search the application or its expressions and
`category` to filter. The service ID refers to the same service in Wallet
and 420Registry. Version, deployment, and verification evidence remain in
the Registry-backed `/v1/apps/{serviceID}` view. The curated response carries
expression status and a Genesis documentation route. It carries no launch
target, contract binding, or settlement data.
