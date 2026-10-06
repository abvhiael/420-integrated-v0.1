node420-compute platform package

This archive contains a node420-compute binary built from one exact repository commit,
a package-local BUILD-METADATA.json file, an example argument file, and platform launcher material.

Before first use:
1. Verify the archive SHA-256 against the top-level CMP-3.13 SHA256SUMS.txt.
2. Run the binary with --version and confirm the expected version/commit/target.
3. Copy worker.args.example to a private configuration location.
4. Replace every identity placeholder with canonical values and keep the file non-world-readable.
5. Confirm a supported container engine and platform-specific resource/security prerequisites before enabling workload execution.

The worker argument file uses one exact CLI argument per non-comment line. It is not a shell script.
Do not put secrets or private keys in this file.

Packaging is not live-network authorization, correctness evidence, settlement authority, or platform runtime certification.
