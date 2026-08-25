package proposer

import (
	"fmt"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

const (
	DomainPrimary   = "420/PRIMARY_SHUFFLE"
	DomainFallback1 = "420/FALLBACK1_SHUFFLE"
	DomainFallback2 = "420/FALLBACK2_SHUFFLE"
)

type SlotProposers struct {
	Slot      uint64
	Primary   uint16
	Fallback1 uint16
	Fallback2 uint16
}

func GenerateRotationSchedule(seatIDs []uint16, seed [32]byte, rotation uint64) ([]SlotProposers, error) {
	if len(seatIDs) < 3 {
		return nil, fmt.Errorf("need at least 3 active seats")
	}
	primary, err := Shuffle(seatIDs, seed, DomainPrimary, rotation)
	if err != nil {
		return nil, err
	}
	fb1, err := Shuffle(seatIDs, seed, DomainFallback1, rotation)
	if err != nil {
		return nil, err
	}
	fb2, err := Shuffle(seatIDs, seed, DomainFallback2, rotation)
	if err != nil {
		return nil, err
	}

	out := make([]SlotProposers, ctypes.SlotsPerRotation)
	for slot := uint64(0); slot < ctypes.SlotsPerRotation; slot++ {
		p := primary[slot%uint64(len(primary))]
		f1 := fb1[slot%uint64(len(fb1))]
		f2 := fb2[slot%uint64(len(fb2))]

		// Deterministically resolve accidental collisions without reshuffling.
		if f1 == p {
			f1 = fb1[(slot+1)%uint64(len(fb1))]
			if f1 == p {
				for k := 2; k < len(fb1); k++ {
					candidate := fb1[(slot+uint64(k))%uint64(len(fb1))]
					if candidate != p {
						f1 = candidate
						break
					}
				}
			}
		}
		if f2 == p || f2 == f1 {
			for k := 1; k < len(fb2)+1; k++ {
				candidate := fb2[(slot+uint64(k))%uint64(len(fb2))]
				if candidate != p && candidate != f1 {
					f2 = candidate
					break
				}
			}
		}
		out[slot] = SlotProposers{
			Slot:      rotation*ctypes.SlotsPerRotation + slot,
			Primary:   p,
			Fallback1: f1,
			Fallback2: f2,
		}
	}
	return out, nil
}
