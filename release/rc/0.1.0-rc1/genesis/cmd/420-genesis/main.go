package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math/big"
	"os"
)

type Allocation struct {
	AmountKief string `json:"amount_kief"`
}

type Ledger struct {
	GenesisSupplyKief string       `json:"genesis_supply_kief"`
	Allocations       []Allocation `json:"allocations"`
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

	if err := validateAIGenesis(*aiGenesis); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(3)
	}
	fmt.Printf("420-genesis: allocation ledger valid (%s kief); AI genesis surface valid\n", total)
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
