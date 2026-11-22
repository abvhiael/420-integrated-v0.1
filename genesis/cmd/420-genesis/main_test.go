package main

import (
	"encoding/json"
	"os"
	"testing"
)

func loadLedgerTest(t *testing.T, path string) Ledger {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var ledger Ledger
	if err := json.Unmarshal(raw, &ledger); err != nil {
		t.Fatal(err)
	}
	return ledger
}

func TestGovernanceGenesisSupplyCandidateAndHistorical(t *testing.T) {
	for _, filename := range []string{
		"../../../config/genesis-allocations.json",
		"../../../testnet/genesis/genesis-allocations.json",
	} {
		t.Run(filename, func(t *testing.T) {
			if err := validateAllocationLedger(loadLedgerTest(t, filename)); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestGovernanceGenesisRejectsDoubleCountAndCounterfeitEarmarks(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Ledger)
	}{
		{"duplicate Genesis allocation", func(l *Ledger) {
			l.Allocations = append(l.Allocations, l.Allocations[0])
		}},
		{"extra new founding mint", func(l *Ledger) {
			l.Allocations = append(l.Allocations, Allocation{
				ID: "founding-operations-new-mint", Amount420: 4_200_000,
				AmountKief: "4200000000000000000000000",
			})
		}},
		{"faked earmarked principal", func(l *Ledger) {
			for i := range l.Allocations {
				if l.Allocations[i].ID == "protocol-reserve" {
					l.Allocations[i].Earmarks420["founding_operations"] = 8_400_000
				}
			}
		}},
		{"redirected frozen reserve", func(l *Ledger) {
			for i := range l.Allocations {
				if l.Allocations[i].ID == "protocol-reserve" {
					l.Allocations[i].Destination = "0x0000000000000000000000000000000000000425"
				}
			}
		}},
		{"drained reserve to unapproved extra payee", func(l *Ledger) {
			for i := range l.Allocations {
				if l.Allocations[i].ID == "protocol-reserve" {
					l.Allocations[i].Amount420 -= 4_200_000
					l.Allocations[i].AmountKief = "4400000000000000000000000"
				}
			}
			l.Allocations = append(l.Allocations, Allocation{
				ID: "founding-operations-independent", Amount420: 4_200_000,
				AmountKief: "4200000000000000000000000",
			})
		}},
		{"kief and token drift", func(l *Ledger) {
			l.Allocations[0].AmountKief = "1"
		}},
		{"unapproved fake V4 commitment", func(l *Ledger) {
			l.Status = "FROZEN_V4"
			for i := range l.Allocations {
				if l.Allocations[i].ID == "protocol-reserve" {
					l.Allocations[i].Earmarks420 = nil
				}
			}
		}},
		{"historical freeze wrongly marked release candidate", func(l *Ledger) {
			l.Status = "FROZEN_V4"
			for i := range l.Allocations {
				if l.Allocations[i].ID == "protocol-reserve" {
					l.Allocations[i].Earmarks420["founding_contingency"] = 42
				}
			}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			l := loadLedgerTest(t, "../../../config/genesis-allocations.json")
			tc.mutate(&l)
			if err := validateAllocationLedger(l); err == nil {
				t.Fatalf("%s was not rejected", tc.name)
			}
		})
	}
}
