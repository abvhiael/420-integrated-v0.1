# Registry contracts

Primary contracts/interfaces are `ProtocolRegistry` and `ServiceIds420`. The Registry stores current and historical service records plus registration-profile commitments.

Generated ABI/NatSpec reference belongs in DOC-10. This manual focuses on integration semantics: monotonically increasing versions, active-state checks, code-bearing implementations and explicit governance for extension service IDs.