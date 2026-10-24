"""教室ごとにばらばらな書き方を、同じ形の回答にそろえる。

言葉の言いかえ（「インスタ」→「Instagram」など）はこのファイルの上の表にまとめている。
新しい書き方が出てきたら、表に 1 行足す。

読めなかったときの扱い
- 満足度が読めない回答 … 集計から外し、「要確認」に出す（集計の中心なので、推測で入れない）
- 年代・日付・「また参加したいか」が読めない … 「不明」「未回答」として集計に残し、「要確認」にも出す
- 直前の行とまったく同じ回答 … 二重入力の疑いとして「要確認」に出す（別の人が同じ答えを書くこともあるので、集計には残す）
- 自由記述に電話番号・メールアドレスらしきもの … 「要確認」に出し、HTML レポートでは伏せ字にする
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime

from .load import RawRow

AGE_BANDS = ["10代", "20代", "30代", "40代", "50代", "60代", "70代以上", "不明"]
AGAIN_VALUES = ["はい", "未定", "いいえ", "未回答"]
CHANNELS = ["Instagram", "チラシ", "知人の紹介", "Web検索", "その他"]

SATISFACTION_WORDS = {"とても満足": 5, "満足": 5, "やや満足": 4, "普通": 3, "ふつう": 3, "やや不満": 2, "不満": 1}
AGAIN_WORDS = {
    "はい": "はい", "○": "はい", "〇": "はい", "したい": "はい",
    "いいえ": "いいえ", "×": "いいえ", "しない": "いいえ",
    "未定": "未定", "△": "未定", "わからない": "未定",
}
# きっかけ: 回答にこの言葉が含まれていたら、その項目に数える（上から順に見る）。どれにも当たらなければ「その他」
# 「SNS」だけの回答は、Instagram 以外の SNS もありうるので「その他」に入れる
CHANNEL_KEYWORDS = [
    ("Instagram", ("instagram", "インスタ")),
    ("チラシ", ("チラシ", "ちらし")),
    ("知人の紹介", ("知人", "友人", "知り合い", "紹介")),
    ("Web検索", ("検索", "ネット", "google", "グーグル")),
]

PHONE_RE = re.compile(r"0\d{1,4}-?\d{1,4}-?\d{3,4}")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


@dataclass(frozen=True)
class Response:
    source: str
    date: date | None
    age: str
    satisfaction: int
    again: str
    channels: tuple[str, ...]
    comment: str


@dataclass(frozen=True)
class Issue:
    source: str
    file: str
    line: int
    reason: str
    raw: str
    excluded: bool  # True = 集計から外した / False = 集計には入れたが確認してほしい


@dataclass
class Result:
    responses: list[Response] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)
    blank_rows: int = 0

    @property
    def excluded(self) -> list[Issue]:
        return [i for i in self.issues if i.excluded]


def text(v) -> str:
    """全角英数を半角に、前後の空白を取る。"""
    if v is None:
        return ""
    return unicodedata.normalize("NFKC", str(v)).strip()


def mask_personal(s: str) -> str:
    """電話番号・メールアドレスらしき部分を伏せる。"""
    return EMAIL_RE.sub("（メールアドレス）", PHONE_RE.sub("（電話番号）", text(s)))


def has_personal(s: str) -> bool:
    t = text(s)
    return bool(PHONE_RE.search(t) or EMAIL_RE.search(t))


def _make_date(y: int, m: int, d: int, raw: str) -> date:
    try:
        return date(y, m, d)
    except ValueError:
        raise ValueError(f"存在しない日付です「{raw}」") from None


def parse_date(v, year: int) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = text(v)
    if not s:
        return None
    m = re.match(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})", s) or re.match(r"^(\d{4})年(\d{1,2})月(\d{1,2})日", s)
    if m:
        return _make_date(int(m[1]), int(m[2]), int(m[3]), s)
    m = re.match(r"^(\d{1,2})[/月](\d{1,2})日?$", s)
    if m:
        return _make_date(year, int(m[1]), int(m[2]), s)
    raise ValueError(f"日付が読めません「{s}」")


def parse_age(v) -> str:
    s = text(v)
    if not s:
        return "不明"
    if s in AGE_BANDS:
        return s
    m = re.match(r"^(\d{1,3})(歳|才)?$", s)
    if m:
        age = int(m[1])
        if age < 10 or age > 110:
            raise ValueError(f"年齢が範囲外です「{s}」")
        return "70代以上" if age >= 70 else f"{age // 10 * 10}代"
    m = re.match(r"^(\d)0代", s)
    if m:
        return "70代以上" if int(m[1]) >= 7 else f"{m[1]}0代"
    raise ValueError(f"年代が読めません「{s}」")


def parse_satisfaction(v) -> int:
    s = text(v)
    if not s:
        raise ValueError("満足度が空欄です")
    if s in SATISFACTION_WORDS:
        return SATISFACTION_WORDS[s]
    # 数字だけ（「4」「4.0」）か、数字＋かっこ書き（Google フォームの「5 (とても満足)」）だけを受ける
    m = re.match(r"^(\d+)(?:\.0+)?$", s) or re.match(r"^(\d+)\s*\(.*\)$", s)
    if m:
        n = int(m[1])
        if 1 <= n <= 5:
            return n
        raise ValueError(f"満足度が 1〜5 の範囲外です「{s}」")
    # 「4.5」「5段階中4」などは推測しない
    raise ValueError(f"満足度が読めません「{s}」")


def parse_again(v) -> str:
    s = text(v)
    if not s:
        return "未回答"
    if s in AGAIN_WORDS:
        return AGAIN_WORDS[s]
    for word in ("いいえ", "はい"):  # 「はい!」「はい(また来たい)」
        if s.startswith(word):
            return word
    raise ValueError(f"「また参加したいか」が読めません「{s}」")


def parse_channels(v) -> tuple[str, ...]:
    s = text(v)
    if not s:
        return ()
    out = []
    for part in re.split(r"[,、/・]", s):
        p = re.sub(r"\s+", "", part).lower()
        if not p:
            continue
        name = next((ch for ch, words in CHANNEL_KEYWORDS if any(w.lower() in p for w in words)), "その他")
        if name not in out:
            out.append(name)
    return tuple(out)


def normalize(rows: list[RawRow], year: int, month: int | None = None) -> Result:
    result = Result()
    prev: RawRow | None = None
    for row in rows:
        raw_text = " / ".join(text(v) for v in row.values.values())
        if not raw_text.replace("/", "").strip():
            result.blank_rows += 1
            continue

        def warn(reason: str, excluded: bool = False) -> None:
            result.issues.append(Issue(row.source, row.file, row.line, reason, raw_text, excluded))

        if prev is not None and prev.source == row.source and prev.values == row.values:
            warn(f"{prev.line} 行目とまったく同じ回答（二重入力の疑い。集計には入れています）")
        prev = row

        try:
            satisfaction = parse_satisfaction(row.values.get("satisfaction"))
        except ValueError as e:
            warn(f"{e}（集計から外しました）", excluded=True)
            continue

        def soft(parse, value, fallback, label):
            try:
                return parse(value)
            except ValueError as e:
                warn(f"{e}（{label}として集計に入れています）")
                return fallback

        d = soft(lambda v: parse_date(v, year), row.values.get("date"), None, "日付なし")
        if d is not None and month is not None and (d.year, d.month) != (year, month):
            warn(f"対象の月（{year}年{month}月）以外の日付です「{d:%Y/%m/%d}」（集計には入れています）")
        comment = text(row.values.get("comment"))
        if has_personal(comment):
            warn("ご意見に電話番号・メールアドレスらしきものがあります（HTML レポートでは伏せています）")

        result.responses.append(Response(
            source=row.source,
            date=d,
            age=soft(parse_age, row.values.get("age"), "不明", "年代「不明」"),
            satisfaction=satisfaction,
            again=soft(parse_again, row.values.get("again"), "未回答", "「未回答」"),
            channels=parse_channels(row.values.get("channel")),
            comment=comment,
        ))
    return result
