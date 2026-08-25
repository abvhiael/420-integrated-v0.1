package committee15

import "fmt"

func Summary(primaryAvailable, fb1Available bool) (string, error) {
	r, err := RunOneSlot(primaryAvailable, fb1Available)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(
		"primary=%d used_seat=%d rank=%d attestations=%d qc_threshold=%d finalized_slot=%d",
		r.ScheduledPrimary, r.UsedSeat, r.UsedRank, r.Attestations, r.QCThreshold, r.FinalizedSlot,
	), nil
}
