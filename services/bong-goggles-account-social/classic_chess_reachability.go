package social

import "encoding/json"

// A work slice bounds CPU, not the total reachable graph. Only an exhausted
// frontier proves impossibility. Checkpoints are private trusted worker state,
// never a client action or a RuleFrame field.
type chessReachabilityJob struct {
	History        []chessRepetition `json:"history,omitempty"`
	exactSeen      map[chessReachPositionKey]struct{}
	Root           chessBoard            `json:"root"`
	Seat           int                   `json:"seat"`
	Nodes          []chessBoard          `json:"nodes"`
	Parents        []int                 `json:"parents"`
	Moves          []string              `json:"moves"`
	Cursor         int                   `json:"cursor"`
	Result         chessMateReachability `json:"result"`
	Witness        []string              `json:"witness,omitempty"`
	seen           map[chessReachKey]struct{}
	storageLimited bool
}

func chessReachIdentity(p chessBoard) chessReachKey {
	return chessReachKey{p.Squares, p.Turn, p.Castle, p.EP}
}
func newChessReachabilityJob(p chessBoard, seat int) (*chessReachabilityJob, error) {
	if seat < 0 || seat > 1 || !chessBoardValid(p) {
		return nil, ErrInvalid
	}
	return &chessReachabilityJob{Root: p, Seat: seat, Nodes: []chessBoard{p}, Parents: []int{-1}, Moves: []string{""}, seen: map[chessReachKey]struct{}{chessReachIdentity(p): {}}}, nil
}
func newChessHistoryReachabilityJob(position chessReachPosition, seat int) (*chessReachabilityJob, error) {
	job, err := newChessReachabilityJob(position.Board, seat)
	if err != nil {
		return nil, err
	}
	key, err := position.key()
	if err != nil || !position.History.valid() || chessOccurrences(position.History, key.Position) == 0 {
		return nil, ErrInvalid
	}
	job.History = []chessRepetition{position.History}
	job.exactSeen = map[chessReachPositionKey]struct{}{key: {}}
	return job, nil
}

func (j *chessReachabilityJob) advance(work int) (chessMateReachability, error) {
	return j.advanceBounded(work, int(^uint(0)>>1))
}

// A node and its full outgoing frontier are added together. A storage cutoff
// preserves the previous cursor and leaves the proof pending.
func (j *chessReachabilityJob) advanceBounded(work, maxNodes int) (chessMateReachability, error) {
	if j == nil || maxNodes < 1 || work < 1 || work > 4096 || j.Seat < 0 || j.Seat > 1 || j.Cursor < 0 || j.Cursor > len(j.Nodes) || len(j.Nodes) == 0 || len(j.Nodes) != len(j.Parents) || len(j.Nodes) != len(j.Moves) {
		return chessMateUnknown, ErrInvalid
	}
	if j.Result != chessMateUnknown {
		return j.Result, nil
	}
	if j.seen == nil || j.History != nil && (len(j.History) != len(j.Nodes) || j.exactSeen == nil) {
		return chessMateUnknown, ErrInvalid
	}
	j.storageLimited = false
	for n := 0; n < work && j.Cursor < len(j.Nodes); n++ {
		i := j.Cursor
		p := j.Nodes[i]
		var moves []chessMove
		var leaf chessMateReachability
		position := chessReachPosition{Board: p}
		if j.History != nil {
			position.History = j.History[i]
			var err error
			leaf, moves, err = position.expand(j.Seat)
			if err != nil {
				return chessMateUnknown, err
			}
		} else {
			moves = p.legal()
			if len(moves) == 0 && p.Turn == 1-j.Seat && p.check(p.Turn) {
				leaf = chessMatePossible
			}
		}
		if len(moves) == 0 {
			j.Cursor++
			if leaf == chessMatePossible {
				path := []string{}
				for k := i; k > 0; k = j.Parents[k] {
					path = append(path, j.Moves[k])
				}
				for l, h := 0, len(path)-1; l < h; l, h = l+1, h-1 {
					path[l], path[h] = path[h], path[l]
				}
				j.Witness = path
				j.Result = chessMatePossible
				return j.Result, nil
			}
			continue
		}
		if chessMaterialCannotMate(p, j.Seat) {
			j.Cursor++
			continue
		}
		type edge struct {
			board    chessBoard
			key      chessReachKey
			move     chessMove
			history  chessRepetition
			exactKey chessReachPositionKey
		}
		edges := make([]edge, 0, len(moves))
		for _, m := range moves {
			if j.History != nil {
				child, _, err := position.after(m)
				if err != nil {
					return chessMateUnknown, err
				}
				key, err := child.key()
				if err != nil {
					return chessMateUnknown, err
				}
				if _, exists := j.exactSeen[key]; !exists {
					edges = append(edges, edge{board: child.Board, move: m, history: child.History, exactKey: key})
				}
			} else {
				q := p.apply(m)
				k := chessReachIdentity(q)
				if _, exists := j.seen[k]; !exists {
					edges = append(edges, edge{board: q, key: k, move: m})
				}
			}
		}
		if len(edges) > maxNodes-len(j.Nodes) {
			j.storageLimited = true
			return chessMateUnknown, nil
		}
		for _, child := range edges {
			if j.History != nil {
				if _, exists := j.exactSeen[child.exactKey]; exists {
					continue
				}
				j.exactSeen[child.exactKey] = struct{}{}
				j.History = append(j.History, child.history)
			} else {
				if _, exists := j.seen[child.key]; exists {
					continue
				}
				j.seen[child.key] = struct{}{}
			}
			j.Nodes = append(j.Nodes, child.board)
			j.Parents = append(j.Parents, i)
			j.Moves = append(j.Moves, child.move.UCI())
		}
		j.Cursor++
	}
	if j.Cursor == len(j.Nodes) {
		j.Result = chessMateImpossible
	}
	return j.Result, nil
}
func (j *chessReachabilityJob) checkpoint() ([]byte, error) { return json.Marshal(j) }

// Restore trusted checkpoint bytes; validate ancestry, legal edges, cursor
// and complete expansions by deterministic replay, rather than trusting a
// serialized result or allowing omitted children to prove impossibility.
func restoreChessReachabilityJob(raw []byte) (*chessReachabilityJob, error) {
	var saved chessReachabilityJob
	if !strictRuleJSON(raw, &saved) || saved.Cursor < 0 || saved.Cursor > len(saved.Nodes) {
		return nil, ErrInvalid
	}
	j, e := newChessReachabilityJob(saved.Root, saved.Seat)
	if saved.History != nil {
		if len(saved.History) == 0 {
			return nil, ErrInvalid
		}
		j, e = newChessHistoryReachabilityJob(chessReachPosition{saved.Root, saved.History[0]}, saved.Seat)
	}
	if e != nil {
		return nil, e
	}
	for j.Cursor < saved.Cursor {
		n := saved.Cursor - j.Cursor
		if n > 4096 {
			n = 4096
		}
		previous := j.Cursor
		if _, e = j.advance(n); e != nil {
			return nil, e
		}
		if j.Cursor <= previous {
			return nil, ErrInvalid
		}
	}
	a, e := j.checkpoint()
	if e != nil {
		return nil, e
	}
	b, e := saved.checkpoint()
	if e != nil || string(a) != string(b) {
		return nil, ErrInvalid
	}
	return j, nil
}

// Finite graph fallback for offline qualification and a resumable worker.
// Do not invoke this unbounded driver in a synchronous request handler.
func chessReachabilityComplete(p chessBoard, seat int) (chessMateReachability, error) {
	j, e := newChessReachabilityJob(p, seat)
	if e != nil {
		return chessMateUnknown, e
	}
	for j.Result == chessMateUnknown {
		if _, e = j.advance(4096); e != nil {
			return chessMateUnknown, e
		}
	}
	return j.Result, nil
}
