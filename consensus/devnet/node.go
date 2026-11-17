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
	activeSeats []uint16
	mu          sync.Mutex
	att         map[uint64]map[uint64]bool
	proposed    map[uint64]ctypes.Root
	blockParent map[uint64]ctypes.Root
	qcPublished map[uint64]bool
	qcSeen      map[string]bool
	tracker     *finality.Tracker
	store       *storage.FileStore
	nextSlot    uint64
	latestQC    storage.QCStatus
	failure error
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
	for i := range seats { seats[i] = uint16(i) }
	sched, err := proposer.GenerateRotationSchedule(seats, cfg.Seed, 0)
	if err != nil { return nil, err }
	var genesis ctypes.Root
	genesis[31] = 1
	tr := finality.NewTracker(ctypes.Checkpoint{Slot: 0, Root: genesis})
	st := storage.NewFileStore(cfg.StatePath)
	next := uint64(0)
	latestQC := storage.QCStatus{}
	if cfg.StatePath != "" {
		if saved, ok, err := st.Load(); err != nil { return nil, err } else if ok {
			tr = finality.NewTrackerFromStatus(finality.Status{Head: saved.Head, Safe: saved.Safe, Finalized: saved.Finalized})
			next = saved.NextSlot
			latestQC = saved.LatestQC
		}
	}
	return &Node{
		cfg: cfg, tr: p2p.NewTCPDevnetTransport(cfg.Bus, cfg.NodeID), schedule: sched, activeSeats: seats,
		att: map[uint64]map[uint64]bool{}, proposed: map[uint64]ctypes.Root{}, blockParent: map[uint64]ctypes.Root{},
		qcPublished: map[uint64]bool{}, qcSeen: map[string]bool{}, tracker: tr, store: st, nextSlot: next, latestQC: latestQC,
	}, nil
}

func rootFor(slot uint64, seat uint16, rank uint8, parent ctypes.Root) ctypes.Root {
	h := sha256.New(); h.Write([]byte("420/devnet/block")); var b [11]byte
	for i := 0; i < 8; i++ { b[i] = byte(slot >> (8 * i)) }
	b[8] = byte(seat); b[9] = byte(seat >> 8); b[10] = rank; h.Write(b[:]); h.Write(parent[:])
	var r ctypes.Root; copy(r[:], h.Sum(nil)); return r
}
func parseRoot(s string) ctypes.Root { var r ctypes.Root; b, _ := hex.DecodeString(s); copy(r[:], b); return r }
func fmtRoot(r ctypes.Root) string { return hex.EncodeToString(r[:]) }

func (n *Node) scheduled(slot uint64) storage.ProposerStatus {
	sp := n.schedule[slot%uint64(len(n.schedule))]
	return storage.ProposerStatus{Slot: slot, Primary: sp.Primary, Fallback1: sp.Fallback1, Fallback2: sp.Fallback2}
}

func (n *Node) persist(lastQC string) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.persistLocked(lastQC)
}
func (n *Node) persistLocked(lastQC string) error {
	if n.failure != nil { return n.failure }
	if n.cfg.StatePath == "" { return nil }
	s := n.tracker.Status()
	latestQC := n.latestQC
	next := n.nextSlot
	seats := append([]uint16(nil), n.activeSeats...)
	err := n.store.Save(storage.Status{
		Head: s.Head, Safe: s.Safe, Finalized: s.Finalized, NextSlot: next,
		ActiveSeats: seats, ScheduledProposer: n.scheduled(next), LatestQC: latestQC, LastQCMessage: lastQC,
	})
	if err != nil { n.failure = err }
	return err
}

func (n *Node) Run(ctx context.Context) error {
	n.tr.Subscribe(p2p.TopicBlock, n.onBlock); n.tr.Subscribe(p2p.TopicAttestation, n.onAtt); n.tr.Subscribe(p2p.TopicQC, n.onQC)
	if err := n.tr.Start(ctx); err != nil { return err }
	defer n.tr.Close(); tick := time.NewTicker(n.cfg.SlotDuration); defer tick.Stop(); produced := uint64(0)
	for {
		if produced >= n.cfg.MaxSlots { return n.persist("") }
		select {
		case <-ctx.Done(): if err:=n.persist(""); err!=nil{return err}; return ctx.Err()
		case <-tick.C:
			n.mu.Lock(); if n.failure!=nil {err:=n.failure;n.mu.Unlock();return err}; slot := n.nextSlot; n.mu.Unlock()
			n.tryPropose(ctx, slot)
			n.mu.Lock(); n.nextSlot++; n.mu.Unlock()
			produced++; if err:=n.persist("");err!=nil{return err}
		}
	}
}
func (n *Node) tryPropose(ctx context.Context, slot uint64) {
	sp := n.schedule[slot%uint64(len(n.schedule))]; var rank uint8 = 255
	if n.cfg.Seat == sp.Primary && !n.cfg.FaultPrimary { rank = 0 }
	if n.cfg.Seat == sp.Fallback1 && n.cfg.FaultPrimary && !n.cfg.FaultFB1 { rank = 1 }
	if n.cfg.Seat == sp.Fallback2 && n.cfg.FaultPrimary && n.cfg.FaultFB1 { rank = 2 }
	if rank == 255 { return }
	n.mu.Lock(); if n.failure!=nil{n.mu.Unlock();return}; parent := n.tracker.Status().Head.Root; n.mu.Unlock()
	r := rootFor(slot, n.cfg.Seat, rank, parent); msg := blockMsg{Slot: slot, Seat: n.cfg.Seat, Rank: rank, Root: fmtRoot(r), Parent: fmtRoot(parent)}
	raw, _ := json.Marshal(msg); _ = n.tr.Publish(ctx, p2p.Envelope{Topic:p2p.TopicBlock,Slot:slot,MessageID:fmt.Sprintf("b-%d-%d",slot,n.cfg.Seat),Payload:raw})
	fmt.Printf("node=%d event=proposal slot=%d seat=%d rank=%d root=%s\n", n.cfg.NodeID, slot, n.cfg.Seat, rank, msg.Root[:12])
}
func (n *Node) onBlock(ctx context.Context, e p2p.Envelope) {
	var b blockMsg; if json.Unmarshal(e.Payload,&b)!=nil{return}; n.mu.Lock(); if n.failure!=nil{n.mu.Unlock();return}; if _,exists:=n.proposed[b.Slot];exists{n.mu.Unlock();return}; n.proposed[b.Slot]=parseRoot(b.Root); n.blockParent[b.Slot]=parseRoot(b.Parent); n.mu.Unlock()
	a:=attMsg{Slot:b.Slot,Seat:n.cfg.Seat,Block:b.Root}; raw,_:=json.Marshal(a); _=n.tr.Publish(ctx,p2p.Envelope{Topic:p2p.TopicAttestation,Slot:b.Slot,MessageID:fmt.Sprintf("a-%d-%d",b.Slot,n.cfg.Seat),Payload:raw})
}
func (n *Node) onAtt(ctx context.Context, e p2p.Envelope) {
	var a attMsg; if json.Unmarshal(e.Payload,&a)!=nil{return}; n.mu.Lock(); if n.failure!=nil{n.mu.Unlock();return}; if n.att[a.Slot]==nil{n.att[a.Slot]=map[uint64]bool{}}; n.att[a.Slot][uint64(a.Seat)]=true; count:=len(n.att[a.Slot]); block:=n.proposed[a.Slot]; parent:=n.blockParent[a.Slot]
	if count>=11 && block!=(ctypes.Root{}) && !n.qcPublished[a.Slot] { n.qcPublished[a.Slot]=true; q:=qcMsg{Slot:a.Slot,Block:fmtRoot(block),Parent:fmtRoot(parent),Signers:count}; raw,_:=json.Marshal(q); n.mu.Unlock(); _=n.tr.Publish(ctx,p2p.Envelope{Topic:p2p.TopicQC,Slot:a.Slot,MessageID:fmt.Sprintf("q-%d-%s",a.Slot,q.Block[:12]),Payload:raw}); return }; n.mu.Unlock()
}
func (n *Node) onQC(ctx context.Context, e p2p.Envelope) {
 var q qcMsg
 if json.Unmarshal(e.Payload,&q)!=nil{return}
 key:=fmt.Sprintf("%d:%s",q.Slot,q.Block)
 n.mu.Lock()
 defer n.mu.Unlock()
 if n.failure!=nil||n.qcSeen[key]{return}
 block,parent:=parseRoot(q.Block),parseRoot(q.Parent)
 qc:=ctypes.QuorumCertificate{Slot:q.Slot+1,BlockRoot:block,ParentRoot:parent}
 candidate:=n.tracker.Clone()
 if err:=candidate.AddCertified(qc);err!=nil{n.failure=err;return}
 status:=candidate.Status()
 if n.cfg.EngineSink!=nil {
  if err:=n.cfg.EngineSink.UpdateForkchoice(ctx,finality.EngineForkchoice(status));err!=nil{n.failure=err;return}
 }
 oldTracker,oldQC:=n.tracker,n.latestQC
 n.tracker=candidate
 n.latestQC=storage.QCStatus{Slot:q.Slot,BlockRoot:q.Block,ParentRoot:q.Parent,Signers:q.Signers}
 if err:=n.persistLocked(key);err!=nil{n.tracker=oldTracker;n.latestQC=oldQC;return}
 n.qcSeen[key]=true
 fmt.Printf("node=%d event=qc slot=%d signers=%d head=%d safe=%d finalized=%d\n",n.cfg.NodeID,q.Slot,q.Signers,status.Head.Slot,status.Safe.Slot,status.Finalized.Slot)
}
