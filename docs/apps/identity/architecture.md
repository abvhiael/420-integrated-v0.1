# 420 Identity architecture

`Identity420` canonically stores profile control/activity, issuer configuration and credential lifecycle. The application may use Names, Registry, Indexer and Search for presentation, but those services do not replace canonical Identity state.

Profile control transfer is two-step. Issuers are governance-curated and assigned trust classes. Credential validity is computed from current lifecycle and issuer/profile state.

Identity remains optional and domain-bounded.