package accounting

import (
	"fmt"
	"math/big"
	"strings"
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
    case "SponsoredValidatorRewardAllocated":
        owner:=f["owner"]
        if owner==ZeroAddress || f["communityFund"]!=CommunityReward ||
           s["sponsor/seen/"+owner]=="1" {return fmt.Errorf("invalid/duplicate sponsored reward evidence")}
        gross:=money(f["gross"])
        share:=new(big.Int).Mul(new(big.Int).Set(gross),big.NewInt(1000))
        share.Div(share,big.NewInt(10000))
        if share.Sign()==0 || share.String()!=f["communityShare"] {
            return fmt.Errorf("sponsored community reward must be exactly 10 percent")
        }
        s["sponsor/seen/"+owner]="1"
        s["sponsor/gross/"+owner]=f["gross"]
        s["sponsor/share/"+owner]=f["communityShare"]
        add("communityRewardAccrued",f["communityShare"])
        add(accrued(CommunityReward),f["communityShare"])
    case "CommunityRewardBackingReceived":
        if f["source"]!=Reward || f["amount"]=="0" {
            return fmt.Errorf("wrong reward backing source or empty backing")
        }
        add("communityRewardBackingReceived",f["amount"])
        if s.get("communityRewardBackingReceived")!=f["backedTotal"] {
            return fmt.Errorf("contradictory backed community reward total")
        }
    case "CommunityRewardSettled":
        if f["reserve"]!=CommunityReward || f["amount"]=="0" ||
           money(sum(s.get("communityRewardSettled"),f["amount"])).
             Cmp(money(s.get("communityRewardBackingReceived")))>0 {
            return fmt.Errorf("unbacked or redirected community reward")
        }
        add("communityRewardSettled",f["amount"])
        if s.get("communityRewardSettled")!=f["settledTotal"] {
            return fmt.Errorf("contradictory community settlement counter")
        }
    case "NativeRewardPaid":
        if f["blockNumber"]!=strconv.FormatUint(n,10) || f["amount"]=="0" {
            return fmt.Errorf("native reward not from this canonical execution block")
        }
        kind:=f["kind"]
        recipient:=f["recipient"]
        if (kind!="0" && kind!="1" && kind!="2" && kind!="3" && kind!="4") ||
           (kind=="2" && recipient!=CommunityReward) ||
           (kind=="3" && recipient!=AttentionTreasury) ||
           (kind=="4" && recipient!=DevelopmentTreasury) {
            return fmt.Errorf("unknown/redirected native reward category")
        }
        add("paid/"+kind+"/"+recipient,f["amount"])
        add("nativeRewardPaid",f["amount"])
    case "RewardApplied":
        if reward == nil {
			return fmt.Errorf("reward without certified outcome")
		}
		settlement, err := sys.DeriveRewardSettlement(*reward)
		if err != nil {
			return err
		}
        credit:=func(owner string,gross *big.Int,kind string) error {
            share:=money(s.get("sponsor/share/"+owner))
            if s["sponsor/seen/"+owner]=="1" &&
               s["sponsor/gross/"+owner]!=gross.String() {
                return fmt.Errorf("sponsor evidence uses wrong canonical proposer/participant gross")
            }
            if share.Cmp(gross)>0 {return fmt.Errorf("community reward exceeds gross")}
            net:=new(big.Int).Sub(new(big.Int).Set(gross),share)
            if s.get("paid/"+kind+"/"+owner)!=net.String() {
                return fmt.Errorf("native operator transfer missing/contradictory: %s",owner)
            }
            delete(s,"paid/"+kind+"/"+owner)
            delete(s,"sponsor/seen/"+owner)
            delete(s,"sponsor/gross/"+owner)
            delete(s,"sponsor/share/"+owner)
            add(accrued(owner),net.String())
            return nil
        }
        if err:=credit(address(reward.Proposer),settlement.ProposerAmount,"0");err!=nil{return err}
        for _,owner:=range reward.Participants {
            if err:=credit(address(owner),settlement.PerParticipantAmount,"1");err!=nil{return err}
        }
        for _,entry:=range []struct{kind,recipient,amount string}{
            {"2",CommunityReward,s.get("communityRewardSettled")},
            {"3",AttentionTreasury,settlement.AttentionAmount.String()},
            {"4",DevelopmentTreasury,settlement.DevelopmentAmount.String()},
        } {
            want:=entry.amount
            if entry.kind=="2" {
                // All community settlements from this block are the difference
                // between cumulative totals before/after this exact RewardApplied.
                want=s.get("paid/2/"+CommunityReward)
                if s.get("communityRewardSettled")!=s.get("communityRewardBackingReceived") ||
                   s.get("communityRewardAccrued")!=s.get("communityRewardSettled") ||
                   s.get(accrued(CommunityReward))!=s.get("communityRewardSettled") {
                    return fmt.Errorf("community backing, settlement and accrual diverge")
                }
            }
            if s.get("paid/"+entry.kind+"/"+entry.recipient)!=want {
                return fmt.Errorf("native Treasury/community transfer missing")
            }
            delete(s,"paid/"+entry.kind+"/"+entry.recipient)
        }
        for k:=range s {
            if strings.HasPrefix(k,"paid/") || strings.HasPrefix(k,"sponsor/") {
                return fmt.Errorf("unexpected native reward or orphaned sponsor evidence: %s",k)
            }
        }
        add("grossSecurityIssued",sum(f["proposerAmount"],f["participantAmount"]))
        add("grossAttentionIssued",f["attentionAmount"])
        add("grossDevelopmentIssued",f["developmentAmount"])
        realized:=sum(sum(s.get("grossSecurityIssued"),s.get("grossAttentionIssued")),s.get("grossDevelopmentIssued"))
        if s.get("nativeRewardPaid")!=realized {
            return fmt.Errorf("native reward disbursements do not conserve realized issuance")
        }
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
