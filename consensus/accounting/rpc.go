package accounting

import (
	"context"
	"fmt"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	ethhash "github.com/420integrated/420-integrated/execution/storage"
	"github.com/420integrated/420-integrated/indexer/model"
	irpc "github.com/420integrated/420-integrated/indexer/rpc"
	"math/big"
	"strconv"
	"strings"
	"time"
)

type RPCSource struct {
	Engine   *eng.Client
	RPC      *irpc.Client
	Evidence []string
}

func NewRPCSource(url string, client *eng.Client, snapshot rec.CertifiedSnapshot) *RPCSource {
	s := &RPCSource{Engine: client, RPC: irpc.NewClient(url, 15*time.Second).WithNativeLogs(client)}
	for _, record := range snapshot.Canonical {
		for _, slash := range record.Outcomes.Slashes {
			s.Evidence = append(s.Evidence, hex32(slash.EvidenceHash))
		}
	}
	return s
}
func (s *RPCSource) Anchor(ctx context.Context, a sys.SequenceAnchor) error {
	observed, err := s.Engine.CanonicalSequenceAnchor(ctx, a.ChainID, a.ExecutionBlock, a.BlockHash)
	if err != nil {
		return err
	}
	if observed != a {
		return fmt.Errorf("execution gateway sequence mismatch")
	}
	return nil
}
func (s *RPCSource) Logs(ctx context.Context, r rec.Record) ([]model.LogRecord, error) {
	n, err := strconv.ParseUint(strings.TrimPrefix(r.Payload.BlockNumber, "0x"), 16, 64)
	if err != nil {
		return nil, err
	}
	b, err := s.RPC.BundleByNumber(ctx, 420, n, model.FinalityHead, "420-accounting-v1")
	if err != nil {
		return nil, err
	}
	if b.Block.Hash != string(r.Payload.BlockHash) || b.Block.ParentHash != string(r.Payload.ParentHash) {
		return nil, fmt.Errorf("execution accounting canonical mismatch")
	}
	return b.Logs, nil
}
func (s *RPCSource) call(ctx context.Context, a sys.SequenceAnchor, to, signature string, args ...string) ([][]byte, error) {
	data := ethhash.EventTopic(signature)[:10]
	for _, arg := range args {
		if len(arg) != 66 || !strings.HasPrefix(arg, "0x") {
			return nil, fmt.Errorf("invalid accounting call argument")
		}
		data += arg[2:]
	}
	var raw string
	if err := s.Engine.Call(ctx, "eth_call", []any{map[string]string{"to": to, "data": data}, map[string]any{"blockHash": hex32(a.BlockHash), "requireCanonical": true}}, &raw); err != nil {
		return nil, err
	}
	return words(raw)
}
func (s *RPCSource) scalar(ctx context.Context, a sys.SequenceAnchor, to, sig, kind string, args ...string) (string, error) {
	w, err := s.call(ctx, a, to, sig, args...)
	if err != nil {
		return "", err
	}
	if len(w) != 1 {
		return "", fmt.Errorf("invalid accounting getter return length")
	}
	return wordValue(kind, w[0])
}
func wordArg(s string) string {
	return "0x" + strings.Repeat("0", 64-len(strings.TrimPrefix(s, "0x"))) + strings.TrimPrefix(s, "0x")
}

var registryScalars = []string{"totalOwnedCustody", "totalProtocolCreditCustody", "totalPendingProtocolCredit", "totalOwnedSlashed", "totalProtocolCreditRecycled", "totalOwnedWithdrawn", "eligibleValidatorCount", "lastRotationSnapshot"}

func (s *RPCSource) State(ctx context.Context, a sys.SequenceAnchor, ids, accounts []string) (State, error) {
	out := State{}
	for _, binding := range []struct{ address, version string }{{Reward, "3"}, {Registry, "3"}, {CreditReserve, "2"}} {
		value, err := s.scalar(ctx, a, binding.address, "protocolVersion()", "uint32")
		if err != nil {
			return nil, err
		}
		if value != binding.version {
			return nil, fmt.Errorf("unqualified accounting contract ABI/version")
		}
	}
	for _, address := range []string{Reward, Registry, CreditReserve, ProtocolReserve} {
		var raw string
		if err := s.Engine.Call(ctx, "eth_getBalance", []any{address, map[string]any{"blockHash": hex32(a.BlockHash), "requireCanonical": true}}, &raw); err != nil {
			return nil, err
		}
		value, ok := new(big.Int).SetString(strings.TrimPrefix(raw, "0x"), 16)
		if !ok || !strings.HasPrefix(raw, "0x") || value.Sign() < 0 || value.BitLen() > 256 {
			return nil, fmt.Errorf("invalid native balance")
		}
		out[balance(address)] = value.String()
	}
	for _, group := range []struct {
		address string
		names   []string
	}{{Registry, registryScalars}, {Reward, []string{"grossSecurityIssued", "grossAttentionIssued", "grossDevelopmentIssued", "nativeRewardPaid", "communityRewardAccrued", "communityRewardBackingReceived", "communityRewardSettled"}}, {CreditReserve, []string{"totalAssigned", "totalFunded"}}} {
		for _, key := range group.names {
			value, err := s.scalar(ctx, a, group.address, key+"()", "uint256")
			if err != nil {
				return nil, err
			}
			out[key] = value
		}
	}
	applied, err := s.scalar(ctx, a, Reward, "rewardApplied(uint64)", "bool", wordArg(fmt.Sprintf("%x", a.ExecutionBlock)))
	if err != nil {
		return nil, err
	}
	out["rewardAppliedCurrent"] = applied
	for _, id := range ids {
		for _, spec := range []struct{ to, sig, kind, key string }{{Registry, "pendingProtocolCredit(bytes32)", "uint256", vk(id, "pending")}, {Registry, "pendingCreditBeneficiary(bytes32)", "address", vk(id, "pendingBeneficiary")}, {CreditReserve, "assignedCredit(bytes32)", "uint256", ck(id, "assigned")}, {CreditReserve, "fundedCredit(bytes32)", "uint256", ck(id, "funded")}, {CreditReserve, "creditBeneficiary(bytes32)", "address", ck(id, "beneficiary")}} {
			value, err := s.scalar(ctx, a, spec.to, spec.sig, spec.kind, id)
			if err != nil {
				return nil, err
			}
			out[spec.key] = value
		}
		w, err := s.call(ctx, a, Registry, "getValidator(bytes32)", id)
		if err != nil {
			return nil, err
		}
		if len(w) < 20 || new(big.Int).SetBytes(w[0]).Cmp(big.NewInt(32)) != 0 {
			return nil, fmt.Errorf("malformed validator tuple")
		}
		tuple := w[1:]
		if new(big.Int).SetBytes(tuple[1]).Cmp(big.NewInt(18*32)) != 0 {
			return nil, fmt.Errorf("malformed validator dynamic offset")
		}
		length := new(big.Int).SetBytes(tuple[18])
		if !length.IsUint64() || (length.Uint64() != 0 && length.Uint64() != 48) || len(tuple) != 19+int((length.Uint64()+31)/32) {
			return nil, fmt.Errorf("malformed validator public key encoding")
		}
		if length.Uint64() == 48 {
			for _, b := range tuple[20][16:] {
				if b != 0 {
					return nil, fmt.Errorf("malformed validator public key padding")
				}
			}
		}
		encodedID, _ := wordValue("bytes32", tuple[0])
		if encodedID != id && new(big.Int).SetBytes(tuple[6]).Sign() != 0 {
			return nil, fmt.Errorf("validator identity mismatch")
		}
		for _, field := range []struct {
			index      int
			name, kind string
		}{{2, "owner", "address"}, {3, "withdrawal", "address"}, {4, "owned", "uint256"}, {5, "credit", "uint256"}, {6, "status", "uint8"}, {7, "registrationBlock", "uint64"}, {8, "effectiveSlot", "uint64"}, {9, "activationRotation", "uint64"}, {10, "scheduledExitRotation", "uint64"}, {11, "cooldownUntilRotation", "uint64"}, {12, "exitNoticeRotation", "uint64"}, {13, "exitEligibleRotation", "uint64"}, {14, "withdrawalHoldStartBlock", "uint64"}, {15, "withdrawableBlock", "uint64"}, {16, "totalSlashed", "uint256"}} {
			value, err := wordValue(field.kind, tuple[field.index])
			if err != nil {
				return nil, err
			}
			out[vk(id, field.name)] = value
		}
	}
	for _, account := range accounts {
		value, err := s.scalar(ctx, a, Reward, "validatorAccrued(address)", "uint256", wordArg(account))
		if err != nil {
			return nil, err
		}
		out[accrued(account)] = value
	}
	for _, evidence := range s.Evidence {
		value, err := s.scalar(ctx, a, Registry, "slashEvidenceApplied(bytes32)", "bool", evidence)
		if err != nil {
			return nil, err
		}
		out["evidence/"+evidence] = value
	}
	return out, nil
}
