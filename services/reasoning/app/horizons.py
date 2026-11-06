from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class Horizon:
    key: str
    label: str
    delta: timedelta


HORIZONS: tuple[Horizon, ...] = (
    Horizon("72h", "72 hours", timedelta(hours=72)),
    Horizon("90d", "90 days", timedelta(days=90)),
    Horizon("1y", "1 year", timedelta(days=365)),
    Horizon("5y", "5 years", timedelta(days=5 * 365 + 1)),
)


def horizon_windows(start: datetime) -> list[dict]:
    return [
        {"key": h.key, "label": h.label, "start": start.isoformat(), "end": (start + h.delta).isoformat()}
        for h in HORIZONS
    ]
