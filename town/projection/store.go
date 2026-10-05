package projection

import (
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/town/model"
)

var (
	ErrInvalidEvent = errors.New("invalid Town projection event")
	ErrChainGap = errors.New("Town projection chain gap")
	ErrParentMismatch = errors.New("Town projection parent mismatch")
	ErrStaleCursor = errors.New("stale Town projection cursor")
	ErrInvalidCursor = errors.New("invalid Town projection cursor")
	ErrInvalidRecovery = errors.New("invalid Town projection recovery state")
)

type EventKind string
const (
	EventPostUpsert EventKind = "POST_UPSERT"
	EventPostTombstone EventKind = "POST_TOMBSTONE"
)

type PostDocument struct {
	ID model.ObjectID
	CommunityID model.ObjectID
	AuthorID model.ObjectID
	Visibility model.Visibility
	ContentRef string
	ContentSHA256 string
	Revision uint64
	UpdatedAt time.Time
	Active bool
	Sequence uint64
}

type Event struct {
	ID string
	Kind EventKind
	Post PostDocument
}

type Block struct {
	Height uint64
	Hash string
	ParentHash string
	Events []Event
}

type Checkpoint struct {
	Height uint64
	Hash string
	Generation uint64
}

type RecoveryState struct {
	Schema string
	Generation uint64
	Blocks []Block
}

type Page struct {
	Items []PostDocument
	NextCursor string
	Generation uint64
}

type Store struct {
	mu sync.RWMutex
	blocks []Block
	posts map[model.ObjectID]PostDocument
	generation uint64
}

func NewStore() *Store { return &Store{posts: map[model.ObjectID]PostDocument{}, generation: 1} }

func (s *Store) ApplyBlock(block Block) error {
	if err:=validateBlock(block); err!=nil{return err}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.blocks)==0 {
		if block.Height!=1 || block.ParentHash!="" { return ErrChainGap }
		s.blocks=[]Block{cloneBlock(block)}
		s.generation++
		return s.rebuildLocked()
	}
	tip:=s.blocks[len(s.blocks)-1]
	if block.Height==tip.Height+1 {
		if block.ParentHash!=tip.Hash { return ErrParentMismatch }
		s.blocks=append(s.blocks,cloneBlock(block))
		return s.rebuildLocked()
	}
	if block.Height<=tip.Height {
		idx:=int(block.Height-1)
		if idx<len(s.blocks) && s.blocks[idx].Hash==block.Hash { return nil }
		if block.Height==1 {
			if block.ParentHash!="" { return ErrParentMismatch }
			s.blocks=nil
		} else {
			parentIdx:=int(block.Height-2)
			if parentIdx<0 || parentIdx>=len(s.blocks) || s.blocks[parentIdx].Hash!=block.ParentHash { return ErrParentMismatch }
			s.blocks=append([]Block(nil),s.blocks[:block.Height-1]...)
		}
		s.blocks=append(s.blocks,cloneBlock(block))
		s.generation++
		return s.rebuildLocked()
	}
	return ErrChainGap
}

func (s *Store) Rebuild(blocks []Block) error {
	tmp:=NewStore()
	for _,b:=range blocks { if err:=tmp.ApplyBlock(b);err!=nil{return err} }
	s.mu.Lock();defer s.mu.Unlock()
	s.blocks=cloneBlocks(tmp.blocks)
	s.posts=clonePosts(tmp.posts)
	s.generation++
	return nil
}

func (s *Store) ListPublicPosts(community model.ObjectID,cursor string,limit int)(Page,error){
	if !community.Valid() || limit<1 || limit>200 { return Page{},ErrInvalidCursor }
	s.mu.RLock();defer s.mu.RUnlock()
	offset,err:=decodeCursor(cursor,s.generation);if err!=nil{return Page{},err}
	items:=make([]PostDocument,0)
	for _,p:=range s.posts {
		if p.CommunityID==community && p.Active && p.Visibility==model.VisibilityPublic { items=append(items,p) }
	}
	sort.Slice(items,func(i,j int)bool{
		if items[i].Sequence==items[j].Sequence{return items[i].ID<items[j].ID}
		return items[i].Sequence<items[j].Sequence
	})
	if offset>len(items){return Page{},ErrStaleCursor}
	end:=offset+limit;if end>len(items){end=len(items)}
	out:=append([]PostDocument(nil),items[offset:end]...)
	next:="";if end<len(items){next=encodeCursor(s.generation,end)}
	return Page{Items:out,NextCursor:next,Generation:s.generation},nil
}

func (s *Store) GetPost(id model.ObjectID)(PostDocument,bool){s.mu.RLock();defer s.mu.RUnlock();p,ok:=s.posts[id];return p,ok}

func (s *Store) Checkpoint() Checkpoint {
	s.mu.RLock();defer s.mu.RUnlock()
	cp:=Checkpoint{Generation:s.generation}
	if len(s.blocks)>0 { cp.Height=s.blocks[len(s.blocks)-1].Height;cp.Hash=s.blocks[len(s.blocks)-1].Hash }
	return cp
}

func (s *Store) SnapshotRecovery() RecoveryState {s.mu.RLock();defer s.mu.RUnlock();return RecoveryState{Schema:"420-town-projection-recovery-v1",Generation:s.generation,Blocks:cloneBlocks(s.blocks)}}

func (s *Store) RestoreRecovery(state RecoveryState) error {
	if state.Schema!="420-town-projection-recovery-v1" || state.Generation==0{return ErrInvalidRecovery}
	tmp:=NewStore()
	for _,b:=range state.Blocks {if err:=tmp.ApplyBlock(b);err!=nil{return fmt.Errorf("%w: %v",ErrInvalidRecovery,err)}}
	s.mu.Lock();defer s.mu.Unlock()
	s.blocks=cloneBlocks(tmp.blocks);s.posts=clonePosts(tmp.posts);s.generation=state.Generation
	return nil
}

func (s *Store) Generation() uint64{s.mu.RLock();defer s.mu.RUnlock();return s.generation}

func (s *Store) rebuildLocked() error {
	posts:=map[model.ObjectID]PostDocument{}
	seen:=map[string]bool{}
	var seq uint64
	for _,b:=range s.blocks {
		for _,e:=range b.Events {
			if seen[e.ID]{return ErrInvalidEvent};seen[e.ID]=true;seq++
			p:=e.Post;p.Sequence=seq
			switch e.Kind {
			case EventPostUpsert:
				p.Active=true;posts[p.ID]=p
			case EventPostTombstone:
				cur,ok:=posts[p.ID];if !ok{return ErrInvalidEvent}
				cur.Active=false;cur.ContentRef="";cur.Revision=p.Revision;cur.UpdatedAt=p.UpdatedAt;cur.Sequence=seq;posts[p.ID]=cur
			default:return ErrInvalidEvent
			}
		}
	}
	s.posts=posts
	return nil
}

func validateBlock(b Block) error {
	if b.Height==0 || strings.TrimSpace(b.Hash)=="" || strings.TrimSpace(b.Hash)!=b.Hash{return ErrInvalidEvent}
	ids:=map[string]bool{}
	for _,e:=range b.Events {
		if strings.TrimSpace(e.ID)=="" || ids[e.ID]{return ErrInvalidEvent};ids[e.ID]=true
		if !e.Post.ID.Valid() || !e.Post.CommunityID.Valid() || !e.Post.AuthorID.Valid() || e.Post.Revision==0 || e.Post.UpdatedAt.IsZero(){return ErrInvalidEvent}
		switch e.Post.Visibility {
		case model.VisibilityPublic,model.VisibilityUnlisted,model.VisibilityFollowers,model.VisibilityCommunityOnly,model.VisibilityPurchasersBackers,model.VisibilityPrivate,model.VisibilityOrganizationMember,model.VisibilityModerators,model.VisibilityAdmins:
		default:return ErrInvalidEvent
		}
		if e.Kind==EventPostUpsert && (strings.TrimSpace(e.Post.ContentSHA256)=="" || strings.TrimSpace(e.Post.ContentRef)==""){return ErrInvalidEvent}
	}
	return nil
}

func encodeCursor(generation uint64,offset int) string{return base64.RawURLEncoding.EncodeToString([]byte(strconv.FormatUint(generation,10)+":"+strconv.Itoa(offset)))}

func decodeCursor(raw string,generation uint64)(int,error){
	if raw==""{return 0,nil}
	if raw!=strings.TrimSpace(raw){return 0,ErrInvalidCursor}
	b,err:=base64.RawURLEncoding.Strict().DecodeString(raw);if err!=nil{return 0,ErrInvalidCursor}
	parts:=strings.Split(string(b),":");if len(parts)!=2{return 0,ErrInvalidCursor}
	g,err:=strconv.ParseUint(parts[0],10,64);if err!=nil||g==0{return 0,ErrInvalidCursor}
	o,err:=strconv.Atoi(parts[1]);if err!=nil||o<0{return 0,ErrInvalidCursor}
	if encodeCursor(g,o)!=raw{return 0,ErrInvalidCursor}
	if g!=generation{return 0,ErrStaleCursor}
	return o,nil
}

func cloneBlock(b Block)Block{b.Events=append([]Event(nil),b.Events...);return b}
func cloneBlocks(in []Block)[]Block{out:=make([]Block,len(in));for i,b:=range in{out[i]=cloneBlock(b)};return out}
func clonePosts(in map[model.ObjectID]PostDocument)map[model.ObjectID]PostDocument{out:=map[model.ObjectID]PostDocument{};for k,v:=range in{out[k]=v};return out}
