package clock

import (
	"errors"
	"time"

	protocol "github.com/420integrated/420-integrated/consensus/types"
)

var ErrBeforeGenesis = errors.New("time is before genesis")

type Clock struct {
	Genesis time.Time
}

func (c Clock) SlotAt(t time.Time) (uint64, error) {
	if t.Before(c.Genesis) {
		return 0, ErrBeforeGenesis
	}
	return uint64(t.Sub(c.Genesis) / (time.Duration(protocol.SlotSeconds) * time.Second)), nil
}

func (c Clock) SlotTime(slot uint64) time.Time {
	return c.Genesis.Add(time.Duration(slot*protocol.SlotSeconds) * time.Second)
}

func Epoch(slot uint64) uint64 {
	return slot / protocol.SlotsPerEpoch
}

func Rotation(slot uint64) uint64 {
	return slot / protocol.SlotsPerRotation
}

func SlotInEpoch(slot uint64) uint64 {
	return slot % protocol.SlotsPerEpoch
}

func EpochInRotation(slot uint64) uint64 {
	return Epoch(slot) % protocol.EpochsPerRotation
}
