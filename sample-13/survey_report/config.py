"""設定ファイル（config.toml）を読む。"""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

FIELDS = ("date", "age", "satisfaction", "again", "channel", "comment")


@dataclass(frozen=True)
class Source:
    name: str
    file: Path
    encoding: str
    header_row: int
    columns: dict[str, str]  # レポートの項目 → ファイルの見出し


@dataclass(frozen=True)
class Config:
    title: str
    organization: str
    period: str
    year: int  # 「10/3」のように年がない日付に補う年
    month: int | None  # 対象の月（ほかの月の日付を「要確認」に出す）
    sources: list[Source]


class ConfigError(Exception):
    pass


def load_config(path: Path) -> Config:
    if not path.exists():
        raise ConfigError(f"設定ファイルが見つかりません: {path}")
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as e:
        raise ConfigError(f"設定ファイルの書き方に誤りがあります（{path.name}）: {e}") from None
    base = path.parent
    report = data.get("report", {})
    period = report.get("period", "")
    m = re.search(r"(\d{4})年?(?:(\d{1,2})月)?", period)
    sources = []
    for i, s in enumerate(data.get("sources", []), start=1):
        missing = [k for k in ("name", "file", "columns") if k not in s]
        if missing:
            raise ConfigError(f"sources の {i} 件目に {', '.join(missing)} がありません")
        unknown = set(s["columns"]) - set(FIELDS)
        if unknown:
            raise ConfigError(f"{s['name']}: columns に知らない項目があります: {', '.join(sorted(unknown))}（使えるのは {', '.join(FIELDS)}）")
        if s["name"] == "全体" or any(x.name == s["name"] for x in sources):
            raise ConfigError(f"教室名「{s['name']}」が重複しているか、集計用の名前（全体）と同じです")
        header_row = s.get("header_row", 1)
        if not isinstance(header_row, int) or header_row < 1:
            raise ConfigError(f"{s['name']}: header_row は 1 以上の数字で書いてください（今は {header_row!r}）")
        if "satisfaction" not in s["columns"]:
            raise ConfigError(f"{s['name']}: columns に satisfaction（満足度）の見出しがありません")
        sources.append(Source(
            name=s["name"],
            file=(base / s["file"]).resolve(),
            encoding=s.get("encoding", "utf-8-sig"),
            header_row=header_row,
            columns=dict(s["columns"]),
        ))
    if not sources:
        raise ConfigError("sources が 1 件もありません")
    return Config(
        title=report.get("title", "アンケート集計"),
        organization=report.get("organization", ""),
        period=period,
        year=int(report.get("year") or (m.group(1) if m else 2026)),
        month=int(m.group(2)) if m and m.group(2) else None,
        sources=sources,
    )
