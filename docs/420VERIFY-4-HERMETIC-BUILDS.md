# 420Verify — VERIFY-4 hermetic compiler and build reproduction

VERIFY-4 adds the deterministic compiler execution boundary used by 420Verify.

## Compiler catalogue

Only explicitly allowlisted Solidity compiler releases may run. Each catalogue entry binds the exact compiler version to a local binary name and SHA-256 digest. A requested version that is absent from the catalogue fails closed. A cached binary whose bytes do not match the recorded digest also fails closed.

Compiler selection is therefore evidence, not ambient host state. 420Verify does not silently substitute a nearby compiler version.

## Isolated worker

Each verification build runs in a fresh temporary working directory. The compiler is invoked using Standard JSON input and receives a deliberately minimal environment. Proxy variables are forced to an unreachable loopback endpoint, `PATH` is replaced, and the worker does not perform dependency downloads or compiler acquisition during a verification build.

The compiler cache is populated and qualified outside the verification request path. Network-dependent source resolution is not permitted by the worker.

## Resource limits

The worker rejects builds that exceed configured input or output limits and applies an execution timeout. These controls are part of the security boundary for hostile or pathological submissions; they do not change compiler semantics.

## Reproduction evidence

A successful worker result records:

- exact compiler version;
- compiler binary SHA-256;
- submitted source-bundle commitment;
- exact Standard JSON compiler-input SHA-256;
- compiler-output SHA-256;
- runtime bytecode produced by the selected contract output;
- creation bytecode produced by the selected contract output;
- explicit evidence that network access was disabled for the worker boundary; and
- explicit evidence that an isolated temporary working directory was used.

The complete compiler output is retained for later mismatch analysis and independent reproduction.

## Trust boundary

420Verify does not claim that a successful compilation is safe or audited. VERIFY-4 only reproduces build output from recorded source/build inputs under an allowlisted compiler identity. Classification against canonical deployed bytecode occurs in VERIFY-5.
