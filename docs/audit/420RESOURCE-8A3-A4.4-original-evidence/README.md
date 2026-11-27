# A4.4 original qualification evidence

Qualified implementation and tests: `fd2cf521bb1001fe43037db5653d03b152617d35` (three successful workflows, one skipped). Exact-HEAD manifest: `../420RESOURCE-8A3-A4.4-final-ci-evidence.json`.

Original Resource workflow log archive and run metadata were retrieved and verified in [retention run 46064906497](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/46064906497), then committed in `bb2fe2c2edd513f591dfa00413093d17451c5aa4`. The ZIP is 671902 bytes, metadata 13428 bytes and checksum manifest 180 bytes. The retention run confirmed the original qualified HEAD, successful run conclusion, ZIP integrity, locally recorded SHA-256 checksums and all eight A4.4 test passes in both profiles. No separately published workflow artifacts existed. Verify retained bytes with `sha256sum -c SHA256SUMS` and `unzip -t resource-qualification-46059379099.zip`.

The automated archive commit triggered action-required PR runs. This provenance-only documentation commit initiates fresh CI; it changes no production code, test assertions or security gates.
