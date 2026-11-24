package social

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

const chessInitialFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

func (p chessBoard) fen() string {
	var b strings.Builder
	for rank := 7; rank >= 0; rank-- {
		if rank != 7 {
			b.WriteByte('/')
		}
		empty := 0
		for file := 0; file < 8; file++ {
			piece := p.Squares[rank*8+file]
			if piece == '.' {
				empty++
				continue
			}
			if empty > 0 {
				b.WriteByte(byte('0' + empty))
				empty = 0
			}
			b.WriteByte(piece)
		}
		if empty > 0 {
			b.WriteByte(byte('0' + empty))
		}
	}
	if p.Turn == 0 {
		b.WriteString(" w ")
	} else {
		b.WriteString(" b ")
	}
	if p.Castle == 0 {
		b.WriteByte('-')
	}
	for i, right := range "KQkq" {
		if p.Castle&(1<<i) != 0 {
			b.WriteRune(right)
		}
	}
	b.WriteByte(' ')
	if p.EP < 0 {
		b.WriteByte('-')
	} else {
		b.WriteString(chessName(p.EP))
	}
	fmt.Fprintf(&b, " %d %d", p.Half, p.Full)
	return b.String()
}

// FEN describes an analysis position only. Live sessions always use sealed genesis.
func parseChessFEN(fen string) (chessBoard, error) {
	var p chessBoard
	if len(fen) > 128 {
		return p, ErrInvalid
	}
	fields := strings.Split(fen, " ")
	if len(fields) != 6 {
		return p, ErrInvalid
	}
	ranks := strings.Split(fields[0], "/")
	if len(ranks) != 8 {
		return p, ErrInvalid
	}
	for index, rank := range ranks {
		file := 0
		for _, token := range rank {
			if file >= 8 {
				return p, ErrInvalid
			}
			switch {
			case token >= '1' && token <= '8':
				end := file + int(token-'0')
				if end > 8 {
					return p, ErrInvalid
				}
				for file < end {
					p.Squares[(7-index)*8+file] = '.'
					file++
				}
			case strings.ContainsRune("PNBRQKpnbrqk", token):
				p.Squares[(7-index)*8+file] = byte(token)
				file++
			default:
				return p, ErrInvalid
			}
		}
		if file != 8 {
			return p, ErrInvalid
		}
	}
	switch fields[1] {
	case "w":
	case "b":
		p.Turn = 1
	default:
		return p, ErrInvalid
	}
	if fields[2] != "-" {
		for _, right := range fields[2] {
			i := strings.IndexRune("KQkq", right)
			if i < 0 || p.Castle&(1<<i) != 0 {
				return p, ErrInvalid
			}
			p.Castle |= 1 << i
		}
	}
	p.EP = -1
	if sq := fields[3]; sq != "-" {
		if len(sq) != 2 || sq[0] < 'a' || sq[0] > 'h' || sq[1] < '1' || sq[1] > '8' {
			return p, ErrInvalid
		}
		p.EP = chessSquare(int(sq[0]-'a'), int(sq[1]-'1'))
	}
	half, halfErr := strconv.Atoi(fields[4])
	full, fullErr := strconv.Atoi(fields[5])
	p.Half, p.Full = half, full
	if halfErr != nil || fullErr != nil || !chessBoardValid(p) || p.fen() != fen {
		return p, ErrInvalid
	}
	return p, nil
}

// ChessPGNMetadata supplies the first six tags. White and Black are seat 0
// and seat 1 respectively. The result always comes from the replayed game.
type ChessPGNMetadata struct {
	Event, Site, Date, Round, White, Black string
}

// ExportChessPGN validates the sealed game's trace while deriving SAN from
// accepted moves. Lifecycle actions never create movetext.
func (a *RulesAdapter) ExportChessPGN(seed [32]byte, trace []RuleTrace, meta ChessPGNMetadata) (string, error) {
	if a == nil || a.definition.GameID != "chess" || len(trace) > a.replayLimit() {
		return "", ErrInvalid
	}
	tags := []struct{ name, value string }{
		{"Event", meta.Event}, {"Site", meta.Site}, {"Date", meta.Date},
		{"Round", meta.Round}, {"White", meta.White}, {"Black", meta.Black},
	}
	var out strings.Builder
	escape := strings.NewReplacer("\\", "\\\\", "\"", "\\\"")
	for _, tag := range tags {
		if tag.value == "" || len(tag.value) > 255 || !utf8.ValidString(tag.value) ||
			strings.ContainsFunc(tag.value, func(r rune) bool { return !unicode.IsPrint(r) }) {
			return "", ErrInvalid
		}
		fmt.Fprintf(&out, "[%s \"%s\"]\n", tag.name, escape.Replace(tag.value))
	}

	state, err := a.initial(seed, 2)
	if err != nil {
		return "", err
	}
	var tokens []string
	for i, step := range trace {
		state, err = a.replayFromVerified(state, int64(i)+1, trace[i:i+1])
		if err != nil {
			return "", err
		}
		var command chessCommand
		if !strictRuleJSON(step.Action, &command) {
			return "", ErrInvalid
		}
		if command.Type != "move" && command.Type != "move-offer" {
			continue
		}
		frame, err := a.decode(state)
		if err != nil {
			return "", err
		}
		data, err := chessDecode(frame)
		if err != nil {
			return "", err
		}
		if step.Seat == 0 {
			tokens = append(tokens, strconv.Itoa(data.Board.Full)+".")
		}
		tokens = append(tokens, data.LastSAN)
	}
	frame, err := a.decode(state)
	if err != nil {
		return "", err
	}
	result := "*"
	if frame.Terminal {
		switch {
		case frame.Winner == nil:
			result = "1/2-1/2"
		case *frame.Winner == 0:
			result = "1-0"
		default:
			result = "0-1"
		}
	}
	fmt.Fprintf(&out, "[Result \"%s\"]\n\n", result)
	lineLength := 0
	for _, token := range append(tokens, result) {
		if lineLength != 0 {
			if lineLength+1+len(token) >= 80 {
				out.WriteByte('\n')
				lineLength = 0
			} else {
				out.WriteByte(' ')
				lineLength++
			}
		}
		out.WriteString(token)
		lineLength += len(token)
	}
	out.WriteByte('\n')
	return out.String(), nil
}

// ExportChessPGN reads one authorized, verified session snapshot. The
// caller supplies display metadata, with White and Black ordered by seat.
func (s *ClassicSessions) ExportChessPGN(ctx context.Context, viewer, id string, meta ChessPGNMetadata) (string, error) {
	if !uuid.MatchString(viewer) || !uuid.MatchString(id) {
		return "", ErrInvalid
	}
	tx, err := s.Store.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	rec, err := scanClassicSession(tx.QueryRowContext(ctx, "SELECT "+classicSessionFields+
		" FROM bg_account_social.classic_sessions WHERE id=$1", id))
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if _, err := s.participant(ctx, tx, rec.RoomID, viewer); err != nil {
		return "", err
	}
	rule, err := s.rule(rec.GameID, rec.RulesVersion, rec.RulesHash)
	if err != nil {
		return "", err
	}
	if !isClassicChess(rule) {
		return "", ErrInvalid
	}
	adapter := rule.(*RulesAdapter)
	var pgn string
	err = s.verifyRulesTraceTx(ctx, tx, rec, adapter, func(seed [32]byte, trace []RuleTrace) error {
		var err error
		pgn, err = adapter.ExportChessPGN(seed, trace, meta)
		return err
	})
	if err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return pgn, nil
}
