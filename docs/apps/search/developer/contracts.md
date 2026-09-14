# Search contracts

420 Search is intentionally contract-free. It observes canonical contracts through 420Indexer and discovers registered service/version metadata through Registry-backed sources.

Search ranking, snippets and sponsorship metadata must never be written back as canonical contract facts.

For contract identity, authorization or deployment provenance, use the owning protocol/Registry/chain source. Generated ABI references belong in DOC-10.
