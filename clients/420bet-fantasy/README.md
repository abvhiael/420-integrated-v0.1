# Daily NHL client primitives

Install the pinned packages in `requirements.txt`. `nhl.py` contains actual X25519/HKDF-SHA256/AES-GCM transport, salted ABI commitments, secp256k1 validation receipts, statistic Merkle trees, independent signed scoring and exact-rational payouts. It also applies the approved source hierarchy to already authenticated normalized captures; it is not a live vendor connector.

The platform custodian is a trusted confidential data processor at launch. Its signing key, encryption-key hash and canonical control group are frozen with each slate. It cannot enter the pools it services. Separate source reporters, fund custodians and dispute resolvers remain independently authorized.

`slate-time.mjs` computes the exact exclusive UTC scoring cutoff using Node's IANA/ICU America/New_York database, including DST. Run its six cases with `node --test clients/420bet-fantasy/slate-time.test.mjs`. Daily schedules span at most 24 elapsed hours; game metadata is bounded, while entrant counts remain uncapped by default. The contract's 23-to-49-hour cutoff bounds accommodate the Eastern clock transitions rather than assuming every local day is 24 hours.

Example owner-side preparation (keep salt/plaintext local; submit only commitment, encrypted envelope and authorized receipt):

```python
from Crypto.Random import get_random_bytes
from nhl import context, encrypt_lineup, commitment

salt = get_random_bytes(32)
envelope = encrypt_lineup(published_x25519_public_key, lineup, salt,
                          context(pool_id, identity_id, next_nonce))
committed = commitment(chain_id, engine_address, pool_id, identity_id,
                       next_nonce, lineup, salt)
```

The authorized custodian calls `validate_and_sign` after checking the actual chain manifest, current verified user, invitation, nonce, lock deadline and its own live capability. The function decrypts the actual envelope, validates the seven slots and commitment and rejects a key that differs from the published hash. It returns a receipt, not plaintext. Persist the latest accepted plaintext/salt in protected storage for mandatory post-lock publication; never expose them through pre-lock logs, API responses, calldata or analytics.

After effective lock, anyone holding the latest matching plaintext/salt can publish it. Publication does not depend on the entrant returning. Failure within the engine's fixed one-hour window cancels the whole affected pool, with full refunds. Key availability, encrypted backups, operator nonparticipation and release monitoring require real operational acceptance before paid deployment.

For scoring, encode `Stats[7]` and `bytes32[][7]` as the scorer witness. `FIELDS` and `STATS_ABI` define the exact V1 schema. No missing/null fields may be zero-filled. Full-game/sole-goalie facts govern shutout eligibility. Source captures must preserve authentication/provenance and correction availability times; source selection alone does not prove a real-world fact.

Run `python -m unittest discover -s clients/420bet-fantasy -p test_nhl.py` from the repository root after installing requirements. The checked-in encryption fixtures contain **public test keys and synthetic lineups only**. Never reuse their keys, salts, nonces or ciphertext for a real contest.

## Sportradar trial capture

Use `sportradar.py` for fixed-origin NHL v7 trial HTTPS captures. Set `SPORTRADAR_API_KEY` in the worker process, or `SPORTRADAR_API_KEY_FILE` to a private file outside this checkout. See `docs/bet/BET-FANTASY-SPORTRADAR-TESTING.md` for commands, request budgeting and the distinction between captured responses, coverage inspection and accepted oracle statistics. Run `python -m unittest discover -s clients/420bet-fantasy -p "test_*.py" -v` to include both provider transport and existing genuine cryptographic client tests. No account/key is required for these explicitly offline tests.
