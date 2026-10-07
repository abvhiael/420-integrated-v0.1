"""Stable DOOBTUBE-5 API errors."""
from dataclasses import dataclass


@dataclass(frozen=True)
class APIError(Exception):
    code: str
    message: str
    status: int

    def __str__(self) -> str:
        return f"{self.code}: {self.message}"


INVALID_REQUEST = "INVALID_REQUEST"
UNAUTHORIZED = "UNAUTHORIZED"
FORBIDDEN = "FORBIDDEN"
NOT_FOUND = "NOT_FOUND"
CONFLICT = "CONFLICT"
IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT"
RATE_LIMITED = "RATE_LIMITED"
UNAVAILABLE = "UNAVAILABLE"
DEPENDENCY_MISMATCH = "DEPENDENCY_MISMATCH"
INTERNAL = "INTERNAL"
