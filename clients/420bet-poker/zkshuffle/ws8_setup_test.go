package shuffle

import (
	"bytes"
	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
	"os"
	"path/filepath"
	"testing"
)

// Explicit opt-in: qualification never regenerates a source-identical setup.
// These are experimental fixture keys, not a production trusted ceremony.
// Persist the proving key as well as the VK so future hand contexts can reuse it.
func TestWS8PersistProvingMaterial(t *testing.T) {
	dir := os.Getenv("POKER_WS8_MATERIAL_DIR")
	if dir == "" {
		t.Skip("requires an explicit WS8 material directory")
	}
	cases := []struct {
		name    string
		circuit frontend.Circuit
	}{
		{"InitialDeck52", &InitialDeck52{}},
		{"Reencrypt52", &Reencrypt52{}},
		{"Delivery", &EncryptedShareDeliveryV1{}},
		{"RecipientPoP", &RecipientKeyPossessionV1{}},
		{"Aggregate", &ThresholdKeyAggregateV1{}},
		{"Partial", &PartialDecryptCircuit{}},
		{"Unmask", &CardUnmaskCircuit{}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := os.MkdirAll(dir, 0755); err != nil {
				t.Fatal(err)
			}
			cs, err := frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, c.circuit)
			if err != nil {
				t.Fatal(err)
			}
			t.Logf("%s constraints: %d", c.name, cs.GetNbConstraints())
			var serialized bytes.Buffer
			if _, err := cs.WriteTo(&serialized); err != nil {
				t.Fatal(err)
			}
			existing, readErr := os.ReadFile(filepath.Join(dir, c.name+".r1cs"))
			if readErr == nil {
				if !bytes.Equal(existing, serialized.Bytes()) {
					t.Fatal("persisted relation differs; refusing to overwrite proving material")
				}
				for _, suffix := range []string{".pk", ".vk", ".sol"} {
					if info, e := os.Stat(filepath.Join(dir, c.name+suffix)); e != nil || info.Size() == 0 {
						t.Fatal("incomplete persisted setup", suffix, e)
					}
				}
				t.Log("reusing source-identical persisted setup")
				return
			}
			if !os.IsNotExist(readErr) {
				t.Fatal(readErr)
			}
			pk, vk, err := groth16.Setup(cs)
			if err != nil {
				t.Fatal(err)
			}
			write := func(suffix string, emit func(*os.File) error) {
				t.Helper()
				f, err := os.Create(filepath.Join(dir, c.name+suffix))
				if err != nil {
					t.Fatal(err)
				}
				if err := emit(f); err != nil {
					f.Close()
					t.Fatal(err)
				}
				if err := f.Close(); err != nil {
					t.Fatal(err)
				}
			}
			write(".r1cs", func(f *os.File) error { _, e := cs.WriteTo(f); return e })
			write(".pk", func(f *os.File) error { _, e := pk.WriteTo(f); return e })
			write(".vk", func(f *os.File) error { _, e := vk.WriteTo(f); return e })
			write(".sol", func(f *os.File) error { return vk.ExportSolidity(f) })
		})
	}
}
