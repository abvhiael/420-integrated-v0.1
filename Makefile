
.PHONY: build test genesis-check jwt node420-upstream clean

build:
	mkdir -p bin
	go build -o bin/fourtwentyd ./consensus/cmd/fourtwentyd
	go build -o bin/node420 ./execution/cmd/node420
	go build -o bin/420-genesis ./genesis/cmd/420-genesis
	go build -o bin/committee15-sim ./simulations/committee15/main
	go build -o bin/devnet-bus ./devnet/cmd/devnet-bus

test:
	go test ./...

genesis-check: build
	./bin/420-genesis -allocations config/genesis-allocations.json

jwt:
	./scripts/generate-jwt.sh jwt.hex

node420-upstream:
	./scripts/build-node420-upstream.sh

clean:
	rm -rf bin

devnet15: build
	python3 scripts/run-devnet15.py

devnet-quorum-loss: build
	python3 scripts/run-devnet15.py --nodes 10

devnet-restart: build
	python3 scripts/run-devnet15.py --nodes 15 --restart-test

live-engine: build
	./scripts/live-engine-smoke.sh

readiness:
	python3 scripts/readiness.py

fault-matrix: build
	python3 scripts/run-fault-matrix.py

soak: build
	python3 scripts/run-soak.py

production-deps:
	./scripts/install-production-deps.sh

networked-qualification:
	./scripts/qualify-networked.sh

testnet-rc:
	python3 scripts/build-testnet-rc.py

release-evidence:
	python3 scripts/check-release-evidence.py

qualify-testnet-rc:
	./scripts/qualify-testnet-rc.sh

testnet-chainid-check:
	python3 scripts/check-chain-id.py --chain-id 420

testnet-preflight:
	python3 scripts/testnet-preflight.py

testnet-launch:
	./scripts/launch-testnet.sh

validator-registry-finalize:
	python3 scripts/finalize-validator-registry.py

genesis-seed-finalize:
	python3 scripts/finalize-genesis-seed.py

canary-preflight:
	python3 scripts/canary-preflight.py

canary-status:
	python3 scripts/canary-controller.py status

canary-start:
	python3 scripts/canary-controller.py start

canary-evaluate:
	python3 scripts/evaluate-canary.py

observation-status:
	python3 scripts/observation-controller.py status

observation-start:
	python3 scripts/observation-controller.py start

observation-evaluate:
	python3 scripts/evaluate-observation.py

public-promotion-preflight:
	python3 scripts/public-promotion-preflight.py

public-testnet-status:
	python3 scripts/public-testnet-controller.py status

public-metadata-finalize:
	python3 scripts/finalize-public-metadata.py

public-launch-preflight:
	python3 scripts/public-launch-preflight.py

public-testnet-launch:
	python3 scripts/public-testnet-controller.py launch

verify-step6:
	python3 scripts/verify-step6-contracts.py

contracts-test:
	@command -v forge >/dev/null 2>&1 && (cd contracts && forge test) || echo "forge not installed; run verify-step6"

verify-genesis-dapps:
	python3 scripts/verify-genesis-dapps.py

verify-step6-all: verify-step6 verify-genesis-dapps

verify-step6-1:
	python3 scripts/verify-step6-1.py

predeploy-readiness:
	python3 scripts/check-predeploy-readiness.py

compile-system-contracts:
	./scripts/compile-system-contracts.sh

genesis-predeploys:
	python3 scripts/generate-genesis-predeploys.py

verify-cadc-swap:
	python3 scripts/verify-cadc-swap.py

verify-420pay-implementation:
	python3 scripts/verify-420pay-implementation.py

test-420pay:
	@command -v forge >/dev/null 2>&1 && (cd contracts && forge test --match-path 'test/*420.t.sol') || (echo "forge not installed" && exit 2)

verify-420pay-hardening:
	python3 scripts/verify-420pay-hardening.py

test-420pay-hardening:
	@command -v forge >/dev/null 2>&1 && (cd contracts && forge test --match-path 'test/*420*.t.sol' -vvv) || (echo "forge not installed" && exit 2)


contracts-bootstrap:
	./scripts/contracts-bootstrap.sh

contracts-build:
	cd contracts && forge build --force --sizes

contracts-test:
	cd contracts && forge test -vvv

contracts-test-ci:
	cd contracts && FOUNDRY_PROFILE=ci forge test -vvv

contracts-coverage:
	cd contracts && forge coverage --report summary

contracts-verify:
	./scripts/contracts-verify.sh

contracts-ci:
	./scripts/contracts-ci.sh

contracts-dev-shell:
	docker build -f Dockerfile.contracts -t 420-contract-dev .
	docker run --rm -it -v "$$(pwd):/workspace" 420-contract-dev

verify-genesis-interfaces:
	python3 scripts/verify-genesis-interface-layer.py

verify-genesis-interface-security:
	python3 scripts/verify-genesis-interface-v1-security.py

verify-genesis-interface-v1:
	python3 scripts/verify-genesis-interface-v1-freeze.py
