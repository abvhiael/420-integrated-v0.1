"""Sport-neutral immutable rule/snapshot identities and exact arithmetic."""
from dataclasses import dataclass
from fractions import Fraction
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nhl import points as nhl_points


class Unresolved(ValueError):
    """Missing/ambiguous information must never become a zero score or a loss."""


def integer(value, minimum=0):
    if type(value) is not int or not minimum <= value < 2**255:
        raise ValueError("bounded integer required")
    return value


def ratio(value):
    if isinstance(value, Fraction):
        return value
    if type(value) is int:
        return Fraction(value)
    if isinstance(value, (list, tuple)) and len(value) == 2:
        return Fraction(integer(value[0], -2**254), integer(value[1], 1))
    raise ValueError("exact integer or numerator/denominator required; floats are forbidden")


def encoded(value):
    if isinstance(value, Fraction):
        return [value.numerator, value.denominator]
    if isinstance(value, dict):
        if any(not isinstance(k,str) for k in value): raise ValueError('canonical object keys must be strings')
        return {str(k): encoded(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [encoded(v) for v in value]
    if type(value) in (str, int, bool) or value is None:
        return value
    raise ValueError("noncanonical configuration value")


def canonical(value):
    return json.dumps(encoded(value), sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


@dataclass(frozen=True)
class Rules:
    """A defensive copy: caller mutation cannot rewrite an existing contest."""
    payload: str

    @classmethod
    def freeze(cls, config):
        for key in ("id", "version", "sport", "format", "scoring", "status", "parameters"):
            if key not in config:
                raise ValueError("incomplete versioned profile: " + key)
        integer(config["version"], 1)
        if any(not isinstance(config[k], str) or not config[k] for k in ("id", "sport", "format", "scoring")):
            raise ValueError("profile identity missing")
        if config["status"] not in ("draft", "test-only"):
            raise ValueError("framework does not manufacture production approval")
        if not isinstance(config["parameters"], dict):
            raise ValueError("parameters must be explicit")
        return cls(canonical(config))

    @property
    def config(self): return json.loads(self.payload)
    @property
    def parameters(self): return self.config["parameters"]
    @property
    def hash(self): return hashlib.sha256(self.payload.encode()).hexdigest()


@dataclass(frozen=True)
class Athlete:
    id: str
    team: str
    positions: frozenset
    salary: int
    goalie: bool = False

    def __post_init__(self):
        integer(self.salary)
        if not self.id or not self.team or not isinstance(self.positions, frozenset) or not self.positions or any(not isinstance(p, str) or not p for p in self.positions):
            raise ValueError("invalid athlete/position snapshot")
        if type(self.goalie) is not bool: raise ValueError("goalie classification required")


class Snapshot:
    def __setattr__(self, name, value):
        if getattr(self, '_sealed', False): raise AttributeError('snapshot is immutable')
        object.__setattr__(self, name, value)

    def __init__(self, sport, version, athletes, lock_at, event_ids):
        self._sport = str(sport); self._version = integer(version, 1)
        self._lock = integer(lock_at, 1); self._events = tuple(event_ids)
        self._athletes = tuple(athletes)
        if not self._sport or not self._events or any(not isinstance(e,str) or not e for e in self._events) or len(set(self._events)) != len(self._events):
            raise ValueError("invalid event/sport snapshot")
        if not self._athletes or len({a.id for a in self._athletes}) != len(self._athletes):
            raise ValueError("duplicate/empty athletes")
        self._hash = digest({"sport": self.sport, "version": self._version, "lock": self.lock_at, "events": self.events,
                             "athletes": [{"id": a.id, "team": a.team, "positions": sorted(a.positions), "salary": a.salary, "goalie": a.goalie} for a in self._athletes]})
        self._sealed = True

    @property
    def sport(self): return self._sport
    @property
    def lock_at(self): return self._lock
    @property
    def events(self): return self._events
    @property
    def athletes(self): return {a.id: a for a in self._athletes}
    @property
    def hash(self): return self._hash


class SportRegistry:
    """Explicit adapters; registration is configuration, not provider authentication."""
    def __init__(self):
        self._scorers = {("NHL", "NHL_DAILY_V1"): lambda athlete, stats: Fraction(nhl_points(stats, athlete.goalie))}

    def register_linear(self, sport, version, required_fields, weights):
        key = (sport, version)
        if key in self._scorers or not sport or not version or set(required_fields) != set(weights):
            raise ValueError("new immutable scorer version and exact field mapping required")
        frozen = {k: ratio(v) for k, v in weights.items()}
        def scorer(athlete, stats):
            if set(stats) != set(frozen) or any(type(v) is not int for v in stats.values()):
                raise Unresolved("complete typed statistics required")
            return sum((integer(stats[k], -2**254) * w for k, w in frozen.items()), Fraction())
        self._scorers[key] = scorer

    def score(self, sport, version, athlete, stats):
        try: scorer = self._scorers[(sport, version)]
        except KeyError: raise Unresolved("unregistered sport/scoring version") from None
        return scorer(athlete, stats)


def allocate(scores, gross, fee_bps, weights, two_entrant_wta):
    """Exact ties, one final floor, deterministic residuals; no asset transfers."""
    integer(gross); integer(fee_bps)
    if fee_bps > 10000 or len(scores) < 2 or type(two_entrant_wta) is not bool:
        raise ValueError("invalid allocation policy")
    if any(not isinstance(k, str) or not k for k in scores): raise ValueError('canonical entry identifiers required')
    weights = list(weights)
    if len(scores) == 2 and two_entrant_wta: weights = [10000]
    if any(type(w) is not int or w < 0 for w in weights) or sum(weights) != 10000 or len(weights) > len(scores):
        raise ValueError("invalid rank weights")
    fee = gross * fee_bps // 10000; prize = gross - fee
    scores = {str(k): ratio(v) for k, v in scores.items()}
    order = sorted(scores, key=lambda k: (-scores[k], k)); exact = {}; start = 0
    while start < len(order):
        end = start + 1
        while end < len(order) and scores[order[end]] == scores[order[start]]: end += 1
        share = Fraction(prize * sum(weights[start:end]), 10000 * (end-start))
        exact.update((k, share) for k in order[start:end]); start = end
    payouts = {k: v.numerator // v.denominator for k, v in exact.items()}
    for k in sorted(k for k, v in exact.items() if v.denominator != 1)[:prize-sum(payouts.values())]: payouts[k] += 1
    if sum(payouts.values()) + fee != gross: raise AssertionError("conservation failure")
    return {"payouts": payouts, "fee": fee, "gross": gross, "order": order}
