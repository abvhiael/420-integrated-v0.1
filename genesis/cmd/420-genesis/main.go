package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math/big"
	"os"
)

type Allocation struct {
	ID              string            `json:"id"`
	Amount420       int64             `json:"amount_420"`
	AmountKief      string            `json:"amount_kief"`
	Destination     string            `json:"destination"`
	Earmarks420     map[string]int64  `json:"earmarks_420"`
	EarmarkTreatment string           `json:"earmark_treatment"`
}

type Ledger struct {
	Schema           string       `json:"schema"`
	Status           string       `json:"status"`
	GenesisSupply420 int64        `json:"genesis_supply_420"`
	GenesisSupplyKief string      `json:"genesis_supply_kief"`
	Allocations      []Allocation `json:"allocations"`
}

type AIGenesis struct {
	AvailableFromGenesis bool              `json:"available_from_genesis"`
	Interfaces           map[string]string `json:"interfaces"`
}

func main() {
	allocations := flag.String("allocations", "config/genesis-allocations.json", "canonical allocation ledger")
	aiGenesis := flag.String("ai-genesis", "config/ai-genesis.json", "native AI genesis configuration")
	flag.Parse()

	raw, err := os.ReadFile(*allocations)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	var ledger Ledger
	if err := json.Unmarshal(raw, &ledger); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	expected, ok := new(big.Int).SetString(ledger.GenesisSupplyKief, 10)
	if !ok {
		fmt.Fprintln(os.Stderr, "invalid genesis_supply_kief")
		os.Exit(1)
	}

	total := new(big.Int)
	for i, a := range ledger.Allocations {
		n, ok := new(big.Int).SetString(a.AmountKief, 10)
		if !ok {
			fmt.Fprintf(os.Stderr, "allocation %d has invalid amount_kief\n", i)
			os.Exit(1)
		}
		total.Add(total, n)
	}

	if total.Cmp(expected) != 0 {
		fmt.Fprintf(os.Stderr, "genesis allocation mismatch: got %s expected %s\n", total, expected)
		os.Exit(2)
	}
	if err := validateAllocationLedger(ledger); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	if err := validateAIGenesis(*aiGenesis); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(3)
	}
	fmt.Printf("420-genesis: allocation ledger valid (%s kief); AI genesis surface valid\n", total)
}


func validateAllocationLedger(ledger Ledger) error {
	if ledger.Schema != "420-integrated-genesis-allocations-v1" ||
		ledger.GenesisSupply420 != 42_000_000 ||
		ledger.GenesisSupplyKief != "42000000000000000000000000" {
		return fmt.Errorf("invalid Genesis supply identity")
	}
	seen := map[string]Allocation{}
	actual := new(big.Int)
	for _, a := range ledger.Allocations {
		if a.ID == "" || a.Amount420 <= 0 {
			return fmt.Errorf("empty allocation ID or nonpositive amount")
		}
		if _, exists := seen[a.ID]; exists {
			return fmt.Errorf("duplicate Genesis allocation ID %q", a.ID)
		}
		seen[a.ID] = a
		value, ok := new(big.Int).SetString(a.AmountKief, 10)
		if !ok || value.Sign() <= 0 {
			return fmt.Errorf("invalid kief amount for %q", a.ID)
		}
		calculated := new(big.Int).Mul(big.NewInt(a.Amount420), big.NewInt(1_000_000_000_000_000_000))
		if value.Cmp(calculated) != 0 {
			return fmt.Errorf("Genesis 420/kief unit mismatch for %q", a.ID)
		}
		actual.Add(actual, value)
	}
	if actual.String() != ledger.GenesisSupplyKief {
		return fmt.Errorf("Genesis sum mismatch: %s", actual)
	}
	if ledger.Status != "FOUNDING_THREE_AMENDMENT_PENDING_V4_RECOMMIT" {
		// Historic V3 bundles are read-only evidence and contain no GOV-PRE-01 earmarks.
		for _, row := range ledger.Allocations {
			if len(row.Earmarks420) != 0 {
				return fmt.Errorf("unapproved Genesis earmarks on non-candidate ledger")
			}
		}
		return nil
	}
	expected := map[string]int64{
		"founder-vesting": 500_000,
		"founder-admin-liquid": 250_000,
		"founder-andrew-liquid": 125_000,
		"founder-janet-liquid": 125_000,
		"validator-bootstrap-reserve": 3_000_000,
		"attention-bootstrap": 4_200_000,
		"development-bootstrap": 4_200_000,
		"community-validator-credit-reserve": 6_300_000,
		"community-testnet-reward-reserve": 2_100_000,
		"public-distribution-genesis-tranche": 4_200_000,
		"public-distribution-day180-tranche": 4_200_000,
		"public-distribution-day365-tranche": 4_200_000,
		"protocol-reserve": 8_600_000,
	}
	if len(seen) != len(expected) {
		return fmt.Errorf("candidate ledger missing or double-counted Genesis allocations")
	}
	for id, amount := range expected {
		row, ok := seen[id]
		if !ok || row.Amount420 != amount {
			return fmt.Errorf("candidate Genesis allocation drift: %s", id)
		}
		if id != "protocol-reserve" && len(row.Earmarks420) != 0 {
			return fmt.Errorf("non-reserve Genesis allocation has earmarks: %s", id)
		}
	}
	reserve := seen["protocol-reserve"]
	if reserve.Destination != "0x0000000000000000000000000000000000000424" ||
		reserve.EarmarkTreatment != "NON_ADDITIVE_WITHIN_PROTOCOL_RESERVE_UNFUNDED_VAULTS" ||
		len(reserve.Earmarks420) != 3 ||
		reserve.Earmarks420["founding_operations"] != 4_200_000 ||
		reserve.Earmarks420["founding_contingency"] != 840_000 ||
		reserve.Earmarks420["unearmarked_protocol_reserve"] != 3_560_000 {
		return fmt.Errorf("ProtocolReserve 8.6m founding earmark reconciliation invalid")
	}
	return nil
}

func validateAIGenesis(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read AI genesis: %w", err)
	}
	var ai AIGenesis
	if err := json.Unmarshal(raw, &ai); err != nil {
		return fmt.Errorf("decode AI genesis: %w", err)
	}
	if !ai.AvailableFromGenesis {
		return fmt.Errorf("AI genesis surface must be available from genesis")
	}
	if len(ai.Interfaces) < 5 {
		return fmt.Errorf("AI genesis requires at least five reserved interfaces")
	}
	seen := map[string]bool{}
	for name, addr := range ai.Interfaces {
		if seen[addr] {
			return fmt.Errorf("duplicate AI system address: %s", addr)
		}
		seen[addr] = true
		if len(addr) != 42 || addr[:2] != "0x" {
			return fmt.Errorf("%s has invalid system address %q", name, addr)
		}
		// Frozen AI interfaces occupy 0x...042F through 0x...0433.
		tail := addr[len(addr)-4:]
		if tail < "042F" || tail > "0433" {
			return fmt.Errorf("%s address %s outside reserved AI range", name, addr)
		}
	}
	return nil
}
