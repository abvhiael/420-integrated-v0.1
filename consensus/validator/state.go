package validator

import (
	"errors"
	"fmt"
	"sort"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

type Status string

const (
	StatusProbation Status = "PROBATION"
	StatusEligible  Status = "ELIGIBLE"
	StatusActive    Status = "ACTIVE"
	StatusCooldown  Status = "COOLDOWN"
	StatusExited    Status = "EXITED"
	StatusSuspended Status = "SUSPENDED"
)

type Record struct {
	ID                    uint64
	ConsensusPubkey       ctypes.BLSPubkey
	Status                Status
	BondKief              string
	SeatID                *uint16
	ActivationRotation    uint64
	ScheduledExitRotation uint64
}

type Seat struct {
	ID          uint16
	OccupantID  uint64
	ActivatedAt uint64
	ExitAt      uint64
}

type Committee struct {
	Rotation uint64
	Seats    []Seat
}

var (
	ErrDuplicateSeat     = errors.New("duplicate seat")
	ErrDuplicateOccupant = errors.New("duplicate occupant")
	ErrSeatTermInvariant = errors.New("seat term invariant violated")
)

func NewCommittee(rotation uint64, seats []Seat) (Committee, error) {
	seenSeat := map[uint16]bool{}
	seenOcc := map[uint64]bool{}
	cp := append([]Seat(nil), seats...)
	sort.Slice(cp, func(i, j int) bool { return cp[i].ID < cp[j].ID })

	for _, s := range cp {
		if seenSeat[s.ID] {
			return Committee{}, fmt.Errorf("%w: %d", ErrDuplicateSeat, s.ID)
		}
		seenSeat[s.ID] = true
		if seenOcc[s.OccupantID] {
			return Committee{}, fmt.Errorf("%w: %d", ErrDuplicateOccupant, s.OccupantID)
		}
		seenOcc[s.OccupantID] = true
		if s.ExitAt != s.ActivatedAt+3 {
			return Committee{}, fmt.Errorf("%w: seat=%d activation=%d exit=%d", ErrSeatTermInvariant, s.ID, s.ActivatedAt, s.ExitAt)
		}
	}
	return Committee{Rotation: rotation, Seats: cp}, nil
}

func (c Committee) Size() int { return len(c.Seats) }

func (c Committee) OccupantForSeat(seat uint16) (uint64, bool) {
	i := sort.Search(len(c.Seats), func(i int) bool { return c.Seats[i].ID >= seat })
	if i < len(c.Seats) && c.Seats[i].ID == seat {
		return c.Seats[i].OccupantID, true
	}
	return 0, false
}

func (c Committee) SeatIDs() []uint16 {
	out := make([]uint16, len(c.Seats))
	for i, s := range c.Seats {
		out[i] = s.ID
	}
	return out
}
