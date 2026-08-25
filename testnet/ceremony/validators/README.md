
# Validator Identity Ceremony

Purpose: replace all 60 placeholder validator records with independently generated public identity
material without ever collecting private keys in the repository.

Each operator must generate:
- one consensus BLS12-381 keypair;
- one secp256k1 owner key;
- one separate secp256k1 withdrawal key;
- one BLS proof of possession.

Only the following are submitted:
- validator ID;
- BLS public key;
- proof of possession;
- owner address;
- withdrawal address;
- client versions;
- operator readiness endpoint;
- bond declaration;
- signed record hash.

Never submit:
- secret keys;
- mnemonics;
- wallet seed phrases;
- JWT secrets.

A ceremony coordinator verifies canonical encodings, proof of possession, uniqueness, record hash,
bond declaration and client version compatibility before setting `status` to `READY`.
