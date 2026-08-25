# node420 execution client

`node420` is the 420 Integrated execution client distribution.

Step 4.1 pins the execution lineage to **go-ethereum v1.17.5**.

The current `execution/cmd/node420` program is a buildable wrapper scaffold only. It does **not**
yet contain or pretend to contain a functioning Geth execution engine. Step 4.2 integrates the
pinned upstream execution client and Engine API.

Rules:
- never track upstream master for consensus releases;
- keep patches minimal and enumerated;
- validator selection/finality/randomness never move into node420;
- public execution RPC remains Ethereum-compatible where possible.
