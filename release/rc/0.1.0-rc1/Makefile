
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
