package api

import (
	"errors"
	"regexp"
	"sort"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

const (
	StakeValidatorRegistryAddress = "0x0000000000000000000000000000000000000423"
	StakeRewardControllerAddress  = "0x0000000000000000000000000000000000000420"
)

var (
	ErrStakeQueryUnavailable = errors.New("stake activity query unavailable")
	bytes32RE = regexp.MustCompile("^0x[0-9a-fA-F]{64}$")
	addressRE = regexp.MustCompile("^0x[0-9a-fA-F]{40}$")
)

type stakeLogReadStore interface {
	LogsByAddresses(addresses ...string) ([]model.LogRecord, error)
}

type stakeEventShape struct {
	name string
	validatorTopic int
	addressTopics []int
}

var stakeTopics = map[string]stakeEventShape{
	"0xf4921b16dd5fd067750553748560958671e9def7858b51a90474a7cd12536f21": {name:"CommunityValidatorReserveBound", addressTopics:[]int{1}},
	"0x097854d7115345c36d952d3857acc395fec20503defff544309457856e3338b7": {name:"ProtocolCreditReceived", validatorTopic:1, addressTopics:[]int{2}},
	"0xa2a976f538a7ab555cdd5ebe16b98219742e028d18675c07917c922ad95e0a4c": {name:"PendingProtocolCreditReturned", validatorTopic:1},
	"0x537da8f0566ceb8b64ae0932b9127c20d0e6541bedb3c8d7b59357c664fea2ca": {name:"ValidatorRegistered", validatorTopic:1, addressTopics:[]int{2,3}},
	"0xf66e607d99abdc63798aa11aa0609e846014125e9dcb3d67d7be804af86e5e33": {name:"OwnedBondToppedUp", validatorTopic:1},
	"0x497cd7b0f7161aed722ba03a503b72b55a11144b2bba36ced3828cdf4503b5b8": {name:"ProtocolCreditReplaced", validatorTopic:1},
	"0x84b1ab46cff6fdbd2c4bb6379b7c0ddc87e51192259f8df4074a3242860f46d7": {name:"ValidatorBondWithdrawn", validatorTopic:1, addressTopics:[]int{2}},
	"0x937c9d231e224d3713ab9670dfc9ce2004c29f78fd2bb43187fe0b8e748eb97a": {name:"ConsensusStateApplied", validatorTopic:1},
	"0x451ab283daf54a8ca4965214024fa70f1f9ac2d8880dc37233a277361c5f1584": {name:"ExitNoticeApplied", validatorTopic:1},
	"0xb2989b10c145e3ec749d2c1aff6ee707b518b4f105704e464e274dd04f8c60ac": {name:"SlashApplied", validatorTopic:1},
	"0x26090c8bdf2134c571fcd01b9d0e5ac59083cd9d7591f9912edda3bd4a280f48": {name:"RotationSnapshotApplied"},
	"0x5a8bf2ea9c2349faa82225b3694a047a85e7c1976f705d009facaeeae6e58858": {name:"ActiveTargetChanged"},
	"0xae18fd01a17597538ecc00e53160b731f191d8172d52086d7ad0ca16a76816ef": {name:"RewardApplied", addressTopics:[]int{2}},
}

type StakeActivityPage struct {
	Meta PageMeta `json:"meta"`
	ValidatorID string `json:"validatorId,omitempty"`
	Address string `json:"address,omitempty"`
	Records []model.StakeActivityRecord `json:"records"`
	CanonicalAuthority bool `json:"canonicalAuthority"`
}

func indexedAddress(topic string) string {
	topic = strings.TrimPrefix(strings.ToLower(topic), "0x")
	if len(topic) != 64 { return "" }
	return "0x" + topic[24:]
}

func (b *StoreBackend) StakeActivity(validatorID, address string, limit uint32) (StakeActivityPage, error) {
	if limit == 0 || limit > 250 { return StakeActivityPage{}, ErrInvalidCursor }
	validatorID = strings.ToLower(strings.TrimSpace(validatorID))
	address = strings.ToLower(strings.TrimSpace(address))
	if validatorID != "" && !bytes32RE.MatchString(validatorID) { return StakeActivityPage{}, errors.New("invalid validator id") }
	if address != "" && !addressRE.MatchString(address) { return StakeActivityPage{}, errors.New("invalid stake address") }
	cp, ok, err := b.store.Checkpoint()
	if err != nil { return StakeActivityPage{}, err }
	if !ok { return StakeActivityPage{}, ErrSnapshotUnavailable }
	reader, ok := b.store.(stakeLogReadStore)
	if !ok { return StakeActivityPage{}, ErrStakeQueryUnavailable }
	logs, err := reader.LogsByAddresses(StakeValidatorRegistryAddress, StakeRewardControllerAddress)
	if err != nil { return StakeActivityPage{}, err }

	records := make([]model.StakeActivityRecord, 0, min(int(limit), len(logs)))
	for _, lg := range logs {
		if lg.ChainID != cp.ChainID || lg.BlockNumber > cp.IndexedHeight || len(lg.Topics) == 0 { continue }
		shape, known := stakeTopics[strings.ToLower(lg.Topics[0])]
		if !known { continue }
		record := model.StakeActivityRecord{
			ChainID:lg.ChainID, BlockNumber:lg.BlockNumber, BlockHash:lg.BlockHash,
			TransactionHash:lg.TransactionHash, TransactionIndex:lg.TransactionIndex, LogIndex:lg.LogIndex,
			ContractAddress:strings.ToLower(lg.Address), EventName:shape.name,
			Topics:append([]string(nil),lg.Topics...), Data:lg.Data,
		}
		if shape.validatorTopic > 0 {
			if len(lg.Topics) <= shape.validatorTopic || !bytes32RE.MatchString(lg.Topics[shape.validatorTopic]) {
				return StakeActivityPage{}, errors.New("malformed Stake validator topic")
			}
			record.ValidatorID = strings.ToLower(lg.Topics[shape.validatorTopic])
		}
		for _, idx := range shape.addressTopics {
			if len(lg.Topics) <= idx { return StakeActivityPage{}, errors.New("malformed Stake address topic") }
			a:=indexedAddress(lg.Topics[idx])
			if a=="" || !addressRE.MatchString(a) { return StakeActivityPage{}, errors.New("malformed Stake address topic") }
			record.Addresses=append(record.Addresses,a)
		}
		if validatorID != "" && record.ValidatorID != validatorID { continue }
		if address != "" {
			found:=false
			for _, a:=range record.Addresses { if a==address {found=true;break} }
			if !found { continue }
		}
		block, exists, err := b.store.Block(lg.BlockNumber)
		if err != nil { return StakeActivityPage{}, err }
		if !exists || block.Hash != lg.BlockHash { return StakeActivityPage{}, ErrSnapshotUnavailable }
		record.Finality = block.Finality
		records=append(records,record)
	}
	sort.Slice(records,func(i,j int)bool{
		if records[i].BlockNumber!=records[j].BlockNumber{return records[i].BlockNumber>records[j].BlockNumber}
		if records[i].TransactionIndex!=records[j].TransactionIndex{return records[i].TransactionIndex>records[j].TransactionIndex}
		return records[i].LogIndex>records[j].LogIndex
	})
	if uint32(len(records)) > limit { records = records[:limit] }
	return StakeActivityPage{
		Meta:PageMeta{ChainID:cp.ChainID,SnapshotHeight:cp.IndexedHeight,SnapshotHash:cp.IndexedHash,SafeHeight:cp.SafeHeight,FinalizedHeight:cp.FinalizedHeight,SchemaVersion:cp.SchemaVersion},
		ValidatorID:validatorID,Address:address,Records:records,CanonicalAuthority:false,
	},nil
}
