"""Salary-cap and captain engines, consuming frozen sport/price/position snapshots."""
from fractions import Fraction
from .core import Rules, SportRegistry, Unresolved, digest, integer, ratio


class SalaryContest:
    def __init__(self, contest_id, rules, snapshot):
        if not contest_id or rules.config["format"] not in ("salary-cap", "captain") or rules.config["sport"] != snapshot.sport:
            raise ValueError("contest/profile/sport mismatch")
        p = rules.parameters
        required = {"slots", "salaryCap", "captainIndex", "captainSalaryMultiplier", "captainScoreMultiplier", "minimumTeams", "maximumPerTeam", "entryLimit"}
        if set(p) != required or not 1 <= len(p["slots"]) <= 32:
            raise ValueError("complete bounded roster policy required")
        if any(not isinstance(s, list) or not s or len(set(s)) != len(s) or any(not isinstance(v, str) or not v for v in s) for s in p["slots"]):
            raise ValueError("explicit slot eligibility required")
        integer(p["salaryCap"], 1); integer(p["minimumTeams"], 1); integer(p["maximumPerTeam"], 1)
        if p["entryLimit"] != 1: raise ValueError("initial framework uses one entry per canonical user")
        captain = p["captainIndex"]
        if rules.config["format"] == "captain":
            if type(captain) is not int or not 0 <= captain < len(p["slots"]): raise ValueError("one captain slot required")
        elif captain is not None: raise ValueError("ordinary salary-cap format has no captain")
        if ratio(p["captainSalaryMultiplier"]) <= 0 or ratio(p["captainScoreMultiplier"]) <= 0:
            raise ValueError("positive rational multipliers required")
        if captain is None and (ratio(p["captainSalaryMultiplier"]) != 1 or ratio(p["captainScoreMultiplier"]) != 1):
            raise ValueError("multipliers require a captain")
        self.id = contest_id; self.rules = rules; self.snapshot = snapshot; self.entries = {}

    def validate(self, lineup):
        lineup = tuple(lineup); p = self.rules.parameters; athletes = self.snapshot.athletes
        if len(lineup) != len(p["slots"]) or len(set(lineup)) != len(lineup): raise ValueError("one unique athlete per slot")
        teams = {}; cost = Fraction()
        for i, aid in enumerate(lineup):
            if aid not in athletes or not athletes[aid].positions.intersection(p["slots"][i]): raise ValueError("ineligible athlete/position")
            athlete = athletes[aid]; teams[athlete.team] = teams.get(athlete.team, 0)+1
            cost += athlete.salary * (ratio(p["captainSalaryMultiplier"]) if i == p["captainIndex"] else 1)
        if cost > p["salaryCap"] or len(teams) < p["minimumTeams"] or max(teams.values()) > p["maximumPerTeam"]:
            raise ValueError("salary or team constraint violated")
        return cost

    def submit(self, canonical_user, lineup, now, nonce):
        lineup=tuple(lineup)
        if not canonical_user or integer(now) >= self.snapshot.lock_at: raise ValueError("entry closed")
        previous = self.entries.get(canonical_user)
        if integer(nonce, 1) != (previous[0]+1 if previous else 1): raise ValueError("stale edit nonce")
        self.validate(lineup)
        self.entries[canonical_user] = (nonce, tuple(lineup))
        return digest({"contest": self.id, "profile": self.rules.hash, "snapshot": self.snapshot.hash,
                       "user": canonical_user, "nonce": nonce, "lineup": tuple(lineup)})

    def score(self, user, stats, snapshot_hash, now, registry=None):
        if integer(now) < self.snapshot.lock_at: raise ValueError("results cannot precede lock")
        if snapshot_hash != self.snapshot.hash: raise Unresolved("statistics refer to another snapshot")
        lineup = self.entries[user][1]
        if set(stats) != set(lineup): raise Unresolved("complete lineup statistics required")
        registry = registry or SportRegistry(); p = self.rules.parameters
        values = [registry.score(self.snapshot.sport, self.rules.config["scoring"], self.snapshot.athletes[aid], stats[aid]) for aid in lineup]
        total = sum((v * (ratio(p["captainScoreMultiplier"]) if i == p["captainIndex"] else 1) for i, v in enumerate(values)), Fraction())
        return {"score": total, "salary": self.validate(lineup), "statement": digest({"domain": "420.FANTASY.SALARY.RESULT.V1", "contest": self.id,
                "profile": self.rules.hash, "snapshot": self.snapshot.hash, "user": user, "nonce": self.entries[user][0], "stats": stats, "score": total})}
