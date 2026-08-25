package devnet

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	eng "github.com/420integrated/420-integrated/consensus/engine"
	"github.com/420integrated/420-integrated/consensus/finality"
	"github.com/420integrated/420-integrated/consensus/p2p"
	"github.com/420integrated/420-integrated/consensus/proposer"
	"github.com/420integrated/420-integrated/consensus/storage"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

type Config struct {
	NodeID       uint64
	Seat         uint16
	Bus          string
	Seed         [32]byte
	FaultPrimary bool
	FaultFB1     bool
	MaxSlots     uint64
	SlotDuration time.Duration
	StatePath    string
	EngineSink   eng.ForkchoiceSink
}

type Node struct {
	cfg         Config
	tr          *p2p.TCPDevnetTransport
	schedule    []proposer.SlotProposers
	mu          sync.Mutex
	att         map[uint64]map[uint64]bool
	proposed    map[uint64]ctypes.Root
	blockParent map[uint64]ctypes.Root
	qcPublished map[uint64]bool
	qcSeen      map[string]bool
	tracker     *finality.Tracker
	store       *storage.FileStore
	nextSlot    uint64
}

type blockMsg struct {
	Slot   uint64 `json:"slot"`
	Seat   uint16 `json:"seat"`
	Rank   uint8  `json:"rank"`
	Root   string `json:"root"`
	Parent string `json:"parent"`
}
type attMsg struct {
	Slot  uint64 `json:"slot"`
	Seat  uint16 `json:"seat"`
	Block string `json:"block"`
}
type qcMsg struct {
	Slot    uint64 `json:"slot"`
	Block   string `json:"block"`
	Parent  string `json:"parent"`
	Signers int    `json:"signers"`
}

func New(cfg Config) (*Node, error) {
	seats := make([]uint16, 15)
	for i := range seats {
		seats[i] = uint16(i)
	}
	sched, err := proposer.GenerateRotationSchedule(seats, cfg.Seed, 0)
	if err != nil {
		return nil, err
	}
	var genesis ctypes.Root
	genesis[31] = 1
	tr := finality.NewTracker(ctypes.Checkpoint{Slot: 0, Root: genesis})
	st := storage.NewFileStore(cfg.StatePath)
	next := uint64(0)
	if cfg.StatePath != "" {
		if saved, ok, err := st.Load(); err != nil {
			return nil, err
		} else if ok {
			tr = finality.NewTrackerFromStatus(finality.Status{
				Head: saved.Head, Safe: saved.Safe, Finalized: saved.Finalized,
			})
			next = saved.NextSlot
		}
	}
	return &Node{
		cfg: cfg, tr: p2p.NewTCPDevnetTransport(cfg.Bus, cfg.NodeID), schedule: sched,
		att: map[uint64]map[uint64]bool{}, proposed: map[uint64]ctypes.Root{},
		blockParent: map[uint64]ctypes.Root{}, qcPublished: map[uint64]bool{}, qcSeen: map[string]bool{},
		tracker: tr, store: st, nextSlot: next,
	}, nil
}

func rootFor(slot uint64, seat uint16, rank uint8, parent ctypes.Root) ctypes.Root {
	h := sha256.New()
	h.Write([]byte("420/devnet/block"))
	var b [11]byte
	for i := 0; i < 8; i++ {
		b[i] = byte(slot >> (8 * i))
	}
	b[8] = byte(seat)
	b[9] = byte(seat >> 8)
	b[10] = rank
	h.Write(b[:])
	h.Write(parent[:])
	var r ctypes.Root
	copy(r[:], h.Sum(nil))
	return r
}
func parseRoot(s string) ctypes.Root {
	var r ctypes.Root
	b, _ := hex.DecodeString(s)
	copy(r[:], b)
	return r
}
func fmtRoot(r ctypes.Root) string { return hex.EncodeToString(r[:]) }

func (n *Node) persist(lastQC string) {
	if n.cfg.StatePath == "" {
		return
	}
	s := n.tracker.Status()
	_ = n.store.Save(storage.Status{
		Head: s.Head, Safe: s.Safe, Finalized: s.Finalized,
		NextSlot: n.nextSlot, LastQCMessage: lastQC,
	})
}

func (n *Node) Run(ctx context.Context) error {
	n.tr.Subscribe(p2p.TopicBlock, n.onBlock)
	n.tr.Subscribe(p2p.TopicAttestation, n.onAtt)
	n.tr.Subscribe(p2p.TopicQC, n.onQC)
	if err := n.tr.Start(ctx); err != nil {
		return err
	}
	defer n.tr.Close()
	tick := time.NewTicker(n.cfg.SlotDuration)
	defer tick.Stop()
	produced := uint64(0)
	for {
		if produced >= n.cfg.MaxSlots {
			n.persist("")
			return nil
		}
		select {
		case <-ctx.Done():
			n.persist("")
			return ctx.Err()
		case <-tick.C:
			n.tryPropose(ctx, n.nextSlot)
			n.nextSlot++
			produced++
			n.persist("")
		}
	}
}
func (n *Node) tryPropose(ctx context.Context, slot uint64) {
	sp := n.schedule[slot%uint64(len(n.schedule))]
	var rank uint8 = 255
	if n.cfg.Seat == sp.Primary && !n.cfg.FaultPrimary {
		rank = 0
	}
	if n.cfg.Seat == sp.Fallback1 && n.cfg.FaultPrimary && !n.cfg.FaultFB1 {
		rank = 1
	}
	if n.cfg.Seat == sp.Fallback2 && n.cfg.FaultPrimary && n.cfg.FaultFB1 {
		rank = 2
	}
	if rank == 255 {
		return
	}
	n.mu.Lock()
	parent := n.tracker.Status().Head.Root
	n.mu.Unlock()
	r := rootFor(slot, n.cfg.Seat, rank, parent)
	msg := blockMsg{Slot: slot, Seat: n.cfg.Seat, Rank: rank, Root: fmtRoot(r), Parent: fmtRoot(parent)}
	raw, _ := json.Marshal(msg)
	_ = n.tr.Publish(ctx, p2p.Envelope{Topic: p2p.TopicBlock, Slot: slot, MessageID: fmt.Sprintf("b-%d-%d", slot, n.cfg.Seat), Payload: raw})
	fmt.Printf("node=%d event=proposal slot=%d seat=%d rank=%d root=%s\n", n.cfg.NodeID, slot, n.cfg.Seat, rank, msg.Root[:12])
}
func (n *Node) onBlock(ctx context.Context, e p2p.Envelope) {
	var b blockMsg
	if json.Unmarshal(e.Payload, &b) != nil {
		return
	}
	n.mu.Lock()
	if _, exists := n.proposed[b.Slot]; exists {
		n.mu.Unlock()
		return
	}
	n.proposed[b.Slot] = parseRoot(b.Root)
	n.blockParent[b.Slot] = parseRoot(b.Parent)
	n.mu.Unlock()
	a := attMsg{Slot: b.Slot, Seat: n.cfg.Seat, Block: b.Root}
	raw, _ := json.Marshal(a)
	_ = n.tr.Publish(ctx, p2p.Envelope{Topic: p2p.TopicAttestation, Slot: b.Slot, MessageID: fmt.Sprintf("a-%d-%d", b.Slot, n.cfg.Seat), Payload: raw})
}
func (n *Node) onAtt(ctx context.Context, e p2p.Envelope) {
	var a attMsg
	if json.Unmarshal(e.Payload, &a) != nil {
		return
	}
	n.mu.Lock()
	if n.att[a.Slot] == nil {
		n.att[a.Slot] = map[uint64]bool{}
	}
	n.att[a.Slot][uint64(a.Seat)] = true
	count := len(n.att[a.Slot])
	block := n.proposed[a.Slot]
	parent := n.blockParent[a.Slot]
	if count >= 11 && block != (ctypes.Root{}) && !n.qcPublished[a.Slot] {
		n.qcPublished[a.Slot] = true
		q := qcMsg{Slot: a.Slot, Block: fmtRoot(block), Parent: fmtRoot(parent), Signers: count}
		raw, _ := json.Marshal(q)
		n.mu.Unlock()
		_ = n.tr.Publish(ctx, p2p.Envelope{Topic: p2p.TopicQC, Slot: a.Slot, MessageID: fmt.Sprintf("q-%d-%s", a.Slot, q.Block[:12]), Payload: raw})
		return
	}
	n.mu.Unlock()
}
func (n *Node) onQC(ctx context.Context, e p2p.Envelope) {
	var q qcMsg
	if json.Unmarshal(e.Payload, &q) != nil {
		return
	}
	key := fmt.Sprintf("%d:%s", q.Slot, q.Block)
	n.mu.Lock()
	if n.qcSeen[key] {
		n.mu.Unlock()
		return
	}
	n.qcSeen[key] = true
	block := parseRoot(q.Block)
	parent := parseRoot(q.Parent)
	qc := ctypes.QuorumCertificate{Slot: q.Slot + 1, BlockRoot: block, ParentRoot: parent}
	_ = n.tracker.AddCertified(qc)
	s := n.tracker.Status()
	n.mu.Unlock()

	if n.cfg.EngineSink != nil {
		_ = n.cfg.EngineSink.UpdateForkchoice(ctx, finality.EngineForkchoice(s))
	}
	n.persist(key)
	fmt.Printf("node=%d event=qc slot=%d signers=%d head=%d safe=%d finalized=%d\n",
		n.cfg.NodeID, q.Slot, q.Signers, s.Head.Slot, s.Safe.Slot, s.Finalized.Slot)
}
