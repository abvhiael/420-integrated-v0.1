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
	ErrInvalidEvent    = errors.New("invalid Town projection event")
	ErrChainGap        = errors.New("Town projection chain gap")
	ErrParentMismatch  = errors.New("Town projection parent mismatch")
	ErrStaleCursor     = errors.New("stale Town projection cursor")
	ErrInvalidCursor   = errors.New("invalid Town projection cursor")
	ErrInvalidRecovery = errors.New("invalid Town projection recovery state")
)

type EventKind string

const (
	EventPostUpsert    EventKind = "POST_UPSERT"
	EventPostTombstone EventKind = "POST_TOMBSTONE"
)

type PostDocument struct {
	ID            model.ObjectID
	CommunityID   model.ObjectID
	AuthorID      model.ObjectID
	Visibility    model.Visibility
	ContentRef    string
	ContentSHA256 string
	Revision      uint64
	UpdatedAt     time.Time
	Active        bool
	Sequence      uint64
}

type Event struct {
	ID   string
	Kind EventKind
	Post PostDocument
}

type Block struct {
	Height     uint64
	Hash       string
	ParentHash string
	Events     []Event
}

type Checkpoint struct {
	Height     uint64
	Hash       string
	Generation uint64
}

type RecoveryState struct {
	Schema     string
	Generation uint64
	Blocks     []Block
}

type Page struct {
	Items      []PostDocument
	NextCursor string
	Generation uint64
}

type Store struct {
	mu         sync.RWMutex
	blocks     []Block
	posts      map[model.ObjectID]PostDocument
	generation uint64
}

func NewStore() *Store {
	return &Store{posts: map[model.ObjectID]PostDocument{}, generation: 1}
}

func (s *Store) ApplyBlock(block Block) error {
	if err := validateBlock(block); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.blocks) == 0 {
		if block.Height != 1 || block.ParentHash != "" {
			return ErrChainGap
		}
		s.blocks = []Block{cloneBlock(block)}
		s.generation++
		return s.rebuildLocked()
	}

	tip := s.blocks[len(s.blocks)-1]
	if block.Height == tip.Height+1 {
		if block.ParentHash != tip.Hash {
			return ErrParentMismatch
		}
		s.blocks = append(s.blocks, cloneBlock(block))
		return s.rebuildLocked()
	}

	if block.Height <= tip.Height {
		idx := int(block.Height - 1)
		if idx < len(s.blocks) && s.blocks[idx].Hash == block.Hash {
			return nil
		}
		if block.Height == 1 {
			if block.ParentHash != "" {
				return ErrParentMismatch
			}
			s.blocks = nil
		} else {
			parentIdx := int(block.Height - 2)
			if parentIdx < 0 || parentIdx >= len(s.blocks) || s.blocks[parentIdx].Hash != block.ParentHash {
				return ErrParentMismatch
			}
			s.blocks = append([]Block(nil), s.blocks[:block.Height-1]...)
		}
		s.blocks = append(s.blocks, cloneBlock(block))
		s.generation++
		return s.rebuildLocked()
	}
	return ErrChainGap
}

func (s *Store) Rebuild(blocks []Block) error {
	tmp := NewStore()
	for _, block := range blocks {
		if err := tmp.ApplyBlock(block); err != nil {
			return err
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.blocks = cloneBlocks(tmp.blocks)
	s.posts = clonePosts(tmp.posts)
	s.generation++
	return nil
}

func (s *Store) ListPublicPosts(community model.ObjectID, cursor string, limit int) (Page, error) {
	if !community.Valid() || limit < 1 || limit > 200 {
		return Page{}, ErrInvalidCursor
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	offset, err := decodeCursor(cursor, s.generation)
	if err != nil {
		return Page{}, err
	}

	items := make([]PostDocument, 0)
	for _, post := range s.posts {
		if post.CommunityID == community && post.Active && post.Visibility == model.VisibilityPublic {
			items = append(items, post)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Sequence == items[j].Sequence {
			return items[i].ID < items[j].ID
		}
		return items[i].Sequence < items[j].Sequence
	})

	if offset > len(items) {
		return Page{}, ErrStaleCursor
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	out := append([]PostDocument(nil), items[offset:end]...)

	next := ""
	if end < len(items) {
		next = encodeCursor(s.generation, end)
	}
	return Page{Items: out, NextCursor: next, Generation: s.generation}, nil
}

func (s *Store) GetPost(id model.ObjectID) (PostDocument, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	post, ok := s.posts[id]
	return post, ok
}

func (s *Store) Checkpoint() Checkpoint {
	s.mu.RLock()
	defer s.mu.RUnlock()

	checkpoint := Checkpoint{Generation: s.generation}
	if len(s.blocks) > 0 {
		checkpoint.Height = s.blocks[len(s.blocks)-1].Height
		checkpoint.Hash = s.blocks[len(s.blocks)-1].Hash
	}
	return checkpoint
}

func (s *Store) SnapshotRecovery() RecoveryState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return RecoveryState{
		Schema:     "420-town-projection-recovery-v1",
		Generation: s.generation,
		Blocks:     cloneBlocks(s.blocks),
	}
}

func (s *Store) RestoreRecovery(state RecoveryState) error {
	if state.Schema != "420-town-projection-recovery-v1" || state.Generation == 0 {
		return ErrInvalidRecovery
	}

	tmp := NewStore()
	for _, block := range state.Blocks {
		if err := tmp.ApplyBlock(block); err != nil {
			return fmt.Errorf("%w: %v", ErrInvalidRecovery, err)
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.blocks = cloneBlocks(tmp.blocks)
	s.posts = clonePosts(tmp.posts)
	s.generation = state.Generation
	return nil
}

func (s *Store) Generation() uint64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.generation
}

func (s *Store) rebuildLocked() error {
	posts := map[model.ObjectID]PostDocument{}
	seen := map[string]bool{}
	var sequence uint64

	for _, block := range s.blocks {
		for _, event := range block.Events {
			if seen[event.ID] {
				return ErrInvalidEvent
			}
			seen[event.ID] = true
			sequence++

			post := event.Post
			post.Sequence = sequence
			switch event.Kind {
			case EventPostUpsert:
				post.Active = true
				posts[post.ID] = post
			case EventPostTombstone:
				current, ok := posts[post.ID]
				if !ok {
					return ErrInvalidEvent
				}
				current.Active = false
				current.ContentRef = ""
				current.Revision = post.Revision
				current.UpdatedAt = post.UpdatedAt
				current.Sequence = sequence
				posts[post.ID] = current
			default:
				return ErrInvalidEvent
			}
		}
	}
	s.posts = posts
	return nil
}

func validateBlock(block Block) error {
	if block.Height == 0 || strings.TrimSpace(block.Hash) == "" || strings.TrimSpace(block.Hash) != block.Hash {
		return ErrInvalidEvent
	}

	ids := map[string]bool{}
	for _, event := range block.Events {
		if strings.TrimSpace(event.ID) == "" || ids[event.ID] {
			return ErrInvalidEvent
		}
		ids[event.ID] = true

		post := event.Post
		if !post.ID.Valid() || !post.CommunityID.Valid() || !post.AuthorID.Valid() || post.Revision == 0 || post.UpdatedAt.IsZero() {
			return ErrInvalidEvent
		}
		switch post.Visibility {
		case model.VisibilityPublic,
			model.VisibilityUnlisted,
			model.VisibilityFollowers,
			model.VisibilityCommunityOnly,
			model.VisibilityPurchasersBackers,
			model.VisibilityPrivate,
			model.VisibilityOrganizationMember,
			model.VisibilityModerators,
			model.VisibilityAdmins:
		default:
			return ErrInvalidEvent
		}
		if event.Kind == EventPostUpsert && (strings.TrimSpace(post.ContentSHA256) == "" || strings.TrimSpace(post.ContentRef) == "") {
			return ErrInvalidEvent
		}
	}
	return nil
}

func encodeCursor(generation uint64, offset int) string {
	payload := strconv.FormatUint(generation, 10) + ":" + strconv.Itoa(offset)
	return base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func decodeCursor(raw string, generation uint64) (int, error) {
	if raw == "" {
		return 0, nil
	}
	if raw != strings.TrimSpace(raw) {
		return 0, ErrInvalidCursor
	}

	payload, err := base64.RawURLEncoding.Strict().DecodeString(raw)
	if err != nil {
		return 0, ErrInvalidCursor
	}
	parts := strings.Split(string(payload), ":")
	if len(parts) != 2 {
		return 0, ErrInvalidCursor
	}

	cursorGeneration, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil || cursorGeneration == 0 {
		return 0, ErrInvalidCursor
	}
	offset, err := strconv.Atoi(parts[1])
	if err != nil || offset < 0 {
		return 0, ErrInvalidCursor
	}
	if encodeCursor(cursorGeneration, offset) != raw {
		return 0, ErrInvalidCursor
	}
	if cursorGeneration != generation {
		return 0, ErrStaleCursor
	}
	return offset, nil
}

func cloneBlock(block Block) Block {
	block.Events = append([]Event(nil), block.Events...)
	return block
}

func cloneBlocks(in []Block) []Block {
	out := make([]Block, len(in))
	for i, block := range in {
		out[i] = cloneBlock(block)
	}
	return out
}

func clonePosts(in map[model.ObjectID]PostDocument) map[model.ObjectID]PostDocument {
	out := map[model.ObjectID]PostDocument{}
	for id, post := range in {
		out[id] = post
	}
	return out
}
