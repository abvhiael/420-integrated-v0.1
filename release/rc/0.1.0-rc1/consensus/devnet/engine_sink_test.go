package devnet

import (
	"context"
	"encoding/json"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	"os"
	"path/filepath"
	"testing"
)

func TestFileEngineSink(t *testing.T) {
	p := filepath.Join(t.TempDir(), "engine.json")
	s := NewFileEngineSink(p)
	st := eng.ForkchoiceStateV1{
		HeadBlockHash: "0x01", SafeBlockHash: "0x02", FinalizedBlockHash: "0x03",
	}
	if err := s.UpdateForkchoice(context.Background(), st); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	var got eng.ForkchoiceStateV1
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if got.FinalizedBlockHash != "0x03" {
		t.Fatalf("%+v", got)
	}
}
