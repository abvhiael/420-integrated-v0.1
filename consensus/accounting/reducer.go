package accounting

import (
	"fmt"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	"strconv"
)

func status(s State, id, next string) error {
	old := s.get(vk(id, "status"))
	if old == "3" || old == "4" {
		if err := s.sub("eligibleValidatorCount", "1"); err != nil {
			return err
		}
	}
	if next == "3" || next == "4" {
		s.add("eligibleValidatorCount", "1")
	}
	s[vk(id, "status")] = next
	return nil
}

// Apply executes only accounting projections of retained contract events. It
// never mutates a contract or substitutes an indexed event for a certified duty.
func Apply(s State, e Event, n uint64, reward *sys.RewardOutcome) error {
	f := e.Fields
	id := f["validatorId"]
	add := s.add
	sub := s.sub
	debit := func(k, v string) error { return sub(k, v) }
	switch e.Name {
	case "CreditAssigned":
		if s.get(ck(id, "assigned")) != "0" || money(f["amount"]).Sign() == 0 {
			return fmt.Errorf("duplicate or empty credit assignment")
		}
		add(ck(id, "assigned"), f["amount"])
		add("totalAssigned", f["amount"])
		s[ck(id, "beneficiary")] = f["beneficiary"]
	case "CreditFunded":
		if s.get(ck(id, "funded")) != "0" || s.get(ck(id, "assigned")) != f["amount"] || s[ck(id, "beneficiary")] != f["beneficiary"] {
			return fmt.Errorf("contradictory credit funding")
		}
		add(ck(id, "funded"), f["amount"])
		add("totalFunded", f["amount"])
		return debit(balance(CreditReserve), f["amount"])
	case "CreditReturned", "CreditReleased":
		if e.Name == "CreditReleased" && s.get(ck(id, "assigned")) != f["amount"] {
			return fmt.Errorf("partial unfunded release")
		}
		if err := debit(ck(id, "assigned"), f["amount"]); err != nil {
			return err
		}
		if err := debit("totalAssigned", f["amount"]); err != nil {
			return err
		}
		if e.Name == "CreditReturned" {
			if err := debit(ck(id, "funded"), f["amount"]); err != nil {
				return err
			}
			if err := debit("totalFunded", f["amount"]); err != nil {
				return err
			}
			add(balance(CreditReserve), f["amount"])
		} else if s.get(ck(id, "funded")) != "0" {
			return fmt.Errorf("funded credit released")
		}
		if s.get(ck(id, "assigned")) == "0" {
			s[ck(id, "beneficiary")] = ZeroAddress
		}
	case "ProtocolCreditReceived":
		if s.get(vk(id, "pending")) != "0" || s.get(vk(id, "status")) != "0" {
			return fmt.Errorf("duplicate/past registration credit")
		}
		add(vk(id, "pending"), f["amount"])
		s[vk(id, "pendingBeneficiary")] = f["beneficiary"]
		add("totalProtocolCreditCustody", f["amount"])
		add("totalPendingProtocolCredit", f["amount"])
		add(balance(Registry), f["amount"])
	case "PendingProtocolCreditReturned":
		if s.get(vk(id, "pending")) != f["amount"] {
			return fmt.Errorf("pending return mismatch")
		}
		s[vk(id, "pending")] = "0"
		s[vk(id, "pendingBeneficiary")] = ZeroAddress
		if err := debit("totalProtocolCreditCustody", f["amount"]); err != nil {
			return err
		}
		if err := debit("totalPendingProtocolCredit", f["amount"]); err != nil {
			return err
		}
		return debit(balance(Registry), f["amount"])
	case "ValidatorRegistered":
		if s.get(vk(id, "status")) != "0" || s.get(vk(id, "pending")) != f["protocolCredit"] {
			return fmt.Errorf("duplicate/contradictory registration")
		}
		if f["protocolCredit"] != "0" && s[vk(id, "pendingBeneficiary")] != f["owner"] {
			return fmt.Errorf("credit beneficiary substitution")
		}
		s[vk(id, "owned")] = f["ownedBond"]
		s[vk(id, "credit")] = f["protocolCredit"]
		s[vk(id, "owner")] = f["owner"]
		s[vk(id, "withdrawal")] = f["withdrawal"]
		s[vk(id, "status")] = "1"
		s[vk(id, "registrationBlock")] = strconv.FormatUint(n, 10)
		s[vk(id, "pending")] = "0"
		s[vk(id, "pendingBeneficiary")] = ZeroAddress
		if err := debit("totalPendingProtocolCredit", f["protocolCredit"]); err != nil {
			return err
		}
		add("totalOwnedCustody", f["ownedBond"])
		add(balance(Registry), f["ownedBond"])
	case "OwnedBondToppedUp", "ProtocolCreditReplaced":
		add(vk(id, "owned"), f["amount"])
		if s.get(vk(id, "owned")) != f["ownedBond"] {
			return fmt.Errorf("owned collateral contradiction")
		}
		add("totalOwnedCustody", f["amount"])
		add(balance(Registry), f["amount"])
		if e.Name == "ProtocolCreditReplaced" {
			if err := debit(vk(id, "credit"), f["amount"]); err != nil {
				return err
			}
			if s.get(vk(id, "credit")) != f["protocolCredit"] {
				return fmt.Errorf("replacement credit contradiction")
			}
			if err := debit("totalProtocolCreditCustody", f["amount"]); err != nil {
				return err
			}
			add("totalProtocolCreditRecycled", f["amount"])
			return debit(balance(Registry), f["amount"])
		}
	case "ConsensusStateApplied":
		if s.get(vk(id, "status")) != f["previousStatus"] {
			return fmt.Errorf("lifecycle previous state contradiction")
		}
		if err := status(s, id, f["newStatus"]); err != nil {
			return err
		}
		for _, k := range []string{"effectiveSlot", "activationRotation", "scheduledExitRotation", "cooldownUntilRotation"} {
			s[vk(id, k)] = f[k]
		}
		if f["newStatus"] == "8" && f["previousStatus"] != "8" {
			s[vk(id, "withdrawalHoldStartBlock")] = strconv.FormatUint(n, 10)
			s[vk(id, "withdrawableBlock")] = strconv.FormatUint(n+105840, 10)
		}
	case "ExitNoticeApplied":
		s[vk(id, "exitNoticeRotation")] = f["noticeRotation"]
		s[vk(id, "exitEligibleRotation")] = f["exitEligibleRotation"]
	case "SlashApplied":
		s["evidence/"+f["evidenceHash"]] = "1"
		if err := debit(vk(id, "owned"), f["ownedSlashed"]); err != nil {
			return err
		}
		if err := debit(vk(id, "credit"), f["creditSlashed"]); err != nil {
			return err
		}
		amount := sum(f["ownedSlashed"], f["creditSlashed"])
		add(vk(id, "totalSlashed"), amount)
		if err := debit("totalOwnedCustody", f["ownedSlashed"]); err != nil {
			return err
		}
		if err := debit("totalProtocolCreditCustody", f["creditSlashed"]); err != nil {
			return err
		}
		add("totalOwnedSlashed", f["ownedSlashed"])
		add("totalProtocolCreditRecycled", f["creditSlashed"])
		add(balance(ProtocolReserve), f["ownedSlashed"])
		if err := status(s, id, f["resultingStatus"]); err != nil {
			return err
		}
		return debit(balance(Registry), amount)
	case "ValidatorBondWithdrawn":
		if money(s.get(vk(id, "withdrawableBlock"))).Cmp(money(strconv.FormatUint(n, 10))) > 0 {
			return fmt.Errorf("premature withdrawal")
		}
		if s.get(vk(id, "status")) != "9" || s.get(vk(id, "owned")) != f["ownedAmount"] || s.get(vk(id, "credit")) != f["recycledCredit"] || s[vk(id, "withdrawal")] != f["withdrawal"] {
			return fmt.Errorf("withdrawal settlement contradiction")
		}
		s[vk(id, "owned")] = "0"
		s[vk(id, "credit")] = "0"
		if err := status(s, id, "7"); err != nil {
			return err
		}
		if err := debit("totalOwnedCustody", f["ownedAmount"]); err != nil {
			return err
		}
		if err := debit("totalProtocolCreditCustody", f["recycledCredit"]); err != nil {
			return err
		}
		add("totalOwnedWithdrawn", f["ownedAmount"])
		add("totalProtocolCreditRecycled", f["recycledCredit"])
		return debit(balance(Registry), sum(f["ownedAmount"], f["recycledCredit"]))
	case "RewardApplied":
		if reward == nil {
			return fmt.Errorf("reward without certified outcome")
		}
		settlement, err := sys.DeriveRewardSettlement(*reward)
		if err != nil {
			return err
		}
		participants := settlement.PerParticipantAmount.String()
		add(accrued(address(reward.Proposer)), f["proposerAmount"])
		for _, a := range reward.Participants {
			add(accrued(address(a)), participants)
		}
		add("grossSecurityIssued", sum(f["proposerAmount"], f["participantAmount"]))
		add("grossAttentionIssued", f["attentionAmount"])
		add("grossDevelopmentIssued", f["developmentAmount"])
	case "TreasuryTransfer":
		if err := debit(balance(e.Log.Address), f["amount"]); err != nil {
			return err
		}
		for _, a := range []string{Registry, CreditReserve, ProtocolReserve} {
			if f["to"] == a {
				add(balance(a), f["amount"])
			}
		}
		return nil
	case "RotationSnapshotApplied":
		s["lastRotationSnapshot"] = f["rotation"]
	}
	return nil
}
