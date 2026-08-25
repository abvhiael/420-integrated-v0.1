package validator

import (
	"github.com/420integrated/420-integrated/consensus/ssz"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

func (c Committee) HashTreeRoot() ctypes.Root {
	fields := make([]ssz.Root, 0, len(c.Seats))
	for _, seat := range c.Seats {
		fields = append(fields, ssz.Container(
			ssz.Uint64Root(uint64(seat.ID)),
			ssz.Uint64Root(seat.OccupantID),
			ssz.Uint64Root(seat.ActivatedAt),
			ssz.Uint64Root(seat.ExitAt),
		))
	}
	return ssz.Merkleize(fields)
}
