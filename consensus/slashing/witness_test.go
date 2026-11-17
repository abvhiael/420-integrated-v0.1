package slashing

import (
	"bytes"
	"os"
	"testing"
)

func TestWitnessSnapshotRejectsVolatileAndDuplicateHistory(t *testing.T) {
	if _, err := NewProtector().Snapshot(); err == nil {
		t.Fatal("volatile signing history accepted")
	}
	path, id := historyFixture(t)
	initHistory(t, path, id)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	altered := bytes.Replace(raw, []byte(`"Schema":"420-slashing-history-v1"`), []byte(`"Schema":"wrong","schema":"420-slashing-history-v1"`), 1)
	if bytes.Equal(raw, altered) {
		t.Fatal("duplicate field fixture did not change")
	}
	if err = os.WriteFile(path, altered, 0600); err != nil {
		t.Fatal(err)
	}
	if p, err := OpenProtector(path, id); err == nil {
		p.Close()
		t.Fatal("duplicate journal fields accepted")
	}
}
