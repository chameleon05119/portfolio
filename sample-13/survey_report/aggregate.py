"""そろえた回答から、レポートに載せる数字を出す。

平均と割合は、ここで四捨五入しておく（Excel と HTML で表示がずれないように）。
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .normalize import AGE_BANDS, AGAIN_VALUES, CHANNELS, Response


def round_half_up(value: float, places: int) -> float:
    q = Decimal(1).scaleb(-places)
    return float(Decimal(str(value)).quantize(q, rounding=ROUND_HALF_UP))


@dataclass(frozen=True)
class Group:
    name: str
    count: int
    average: float | None  # 満足度の平均（小数第 1 位で四捨五入）
    distribution: dict[int, int]  # 満足度 5〜1 → 件数
    again: dict[str, int]
    again_rate: float | None  # 「はい」÷（「未回答」を除く回答数）。百分率の整数で四捨五入した割合（0.74 など）
    channels: dict[str, int]  # 複数選択はそれぞれ 1 件と数える
    ages: dict[str, int]


def summarize(name: str, responses: list[Response]) -> Group:
    n = len(responses)
    dist = Counter(r.satisfaction for r in responses)
    again = Counter(r.again for r in responses)
    answered = n - again["未回答"]
    channels = Counter(c for r in responses for c in r.channels)
    ages = Counter(r.age for r in responses)
    return Group(
        name=name,
        count=n,
        average=round_half_up(sum(r.satisfaction for r in responses) / n, 1) if n else None,
        distribution={s: dist[s] for s in (5, 4, 3, 2, 1)},
        again={k: again[k] for k in AGAIN_VALUES},
        again_rate=round_half_up(again["はい"] / answered, 2) if answered else None,
        channels={c: channels[c] for c in CHANNELS},
        ages={a: ages[a] for a in AGE_BANDS},
    )


def by_source(responses: list[Response], order: list[str]) -> list[Group]:
    groups = [summarize(name, [r for r in responses if r.source == name]) for name in order]
    groups.append(summarize("全体", responses))
    return groups
