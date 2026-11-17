package accounting

import (
	"encoding/json"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	"github.com/420integrated/420-integrated/indexer/model"
	"os"
	"strings"
	"testing"
)

func TestRealEVMFinancialReconstruction(t *testing.T) {
	path := os.Getenv("STAKE_ACCOUNTING_EVM_FIXTURE")
	if path == "" {
		t.Skip("run scripts/qualify-stake-accounting.py for required real-EVM qualification")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var steps []struct {
		Block uint64
		Logs  []struct {
			Address string
			Topics  []string
			Data    string
		}
		State State
	}
	if err = json.Unmarshal(raw, &steps); err != nil {
		t.Fatal(err)
	}
	if len(steps) < 8 {
		t.Fatal("incomplete EVM evidence")
	}
	s := State{}
	for k, v := range steps[0].State {
		if !strings.HasPrefix(k, "validator/") && !strings.HasPrefix(k, "credit/") {
			s[k] = v
		}
	}
	reward := &sys.RewardOutcome{BlockNumber: 1, ActiveCount: 15, Proposer: sys.Address{1}, Participants: []sys.Address{{2}, {3}}}
	for i, step := range steps {
		for _, log := range step.Logs {
			l := model.LogRecord{Address: strings.ToLower(log.Address), Topics: log.Topics, Data: log.Data}
			e, err := Decode(l)
			if err != nil {
				t.Fatalf("step %d: %v", i, err)
			}
			if err = Apply(s, e, step.Block, reward); err != nil {
				t.Fatalf("step %d %s: %v", i, e.Name, err)
			}
		}
		for k, want := range step.State {
			if s.get(k) != want {
				t.Fatalf("step %d %s expected getter=%s reconstructed=%s", i, k, want, s.get(k))
			}
		}
	}
}
