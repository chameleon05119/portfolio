from datetime import date, datetime

import pytest

from survey_report.load import RawRow
from survey_report.normalize import mask_personal, normalize, parse_age, parse_again, parse_channels, parse_date, parse_satisfaction


@pytest.mark.parametrize("raw, want", [
    ("5 (とても満足)", 5), ("1 (不満)", 1), ("4", 4), ("４", 4), (3, 3), ("4.0", 4),
    ("満足", 5), ("やや満足", 4), ("普通", 3), ("やや不満", 2), ("不満", 1),
])
def test_satisfaction(raw, want):
    assert parse_satisfaction(raw) == want


@pytest.mark.parametrize("raw", ["", None, "6", "0", "とても良い", "4.5", "3.9", "5段階中4", "45"])
def test_satisfaction_rejects(raw):
    with pytest.raises(ValueError):
        parse_satisfaction(raw)


@pytest.mark.parametrize("raw, want", [
    ("30代", "30代"), (34, "30代"), ("34歳", "30代"), ("７２", "70代以上"), ("70代", "70代以上"), ("", "不明"), (None, "不明"),
])
def test_age(raw, want):
    assert parse_age(raw) == want


def test_age_rejects_out_of_range():
    with pytest.raises(ValueError):
        parse_age("3")


@pytest.mark.parametrize("raw, want", [
    ("はい", "はい"), ("○", "はい"), ("したい", "はい"), ("×", "いいえ"), ("しない", "いいえ"),
    ("△", "未定"), ("わからない", "未定"), ("", "未回答"), ("はい!", "はい"), ("はい（また来たい）", "はい"),
])
def test_again(raw, want):
    assert parse_again(raw) == want


@pytest.mark.parametrize("raw, want", [
    ("Instagram, チラシ", ("Instagram", "チラシ")),
    ("インスタ", ("Instagram",)),
    ("SNS", ("その他",)),  # Instagram 以外の SNS もあるので決めつけない
    ("Instagram（インスタ）", ("Instagram",)),
    ("インスタグラム", ("Instagram",)),
    ("Web 検索", ("Web検索",)),
    ("インターネット検索", ("Web検索",)),
    ("友人", ("知人の紹介",)),
    ("知り合い、ネット", ("知人の紹介", "Web検索")),
    ("ポスター", ("その他",)),
    ("インスタ・Instagram", ("Instagram",)),  # 同じものは 1 回だけ数える
    ("", ()),
])
def test_channels(raw, want):
    assert parse_channels(raw) == want


@pytest.mark.parametrize("raw, want", [
    ("2026/10/03 12:23:15", date(2026, 10, 3)),
    ("10/5", date(2026, 10, 5)),
    ("10月5日", date(2026, 10, 5)),
    ("2026年10月5日", date(2026, 10, 5)),
    (datetime(2026, 10, 7, 9, 0), date(2026, 10, 7)),
    (date(2026, 10, 8), date(2026, 10, 8)),
    ("", None),
])
def test_date(raw, want):
    assert parse_date(raw, 2026) == want


def test_date_rejects_impossible_day_in_japanese():
    with pytest.raises(ValueError, match="存在しない日付です「2/30」"):
        parse_date("2/30", 2026)


def row(line, **values):
    base = {"date": "10/3", "age": "30代", "satisfaction": "満足", "again": "したい", "channel": "チラシ", "comment": ""}
    return RawRow("テスト教室", "test.csv", line, {**base, **values})


def reasons(result):
    return [(i.line, i.excluded, i.reason) for i in result.issues]


def test_normalize_blank_duplicate_and_bad_satisfaction():
    rows = [
        row(2),
        row(3, comment="楽しかった"),
        row(4, comment="楽しかった"),  # 直前と同じ → 二重入力の疑い（集計には入れる）
        row(5, date="", age="", satisfaction="", again="", channel="", comment=""),  # 空行
        row(6, satisfaction="6"),  # 範囲外 → 集計から外す
    ]
    result = normalize(rows, 2026)
    assert len(result.responses) == 3
    assert result.blank_rows == 1
    got = reasons(result)
    assert got[0][:2] == (4, False) and "二重入力の疑い" in got[0][2]
    assert got[1][:2] == (6, True) and "範囲外" in got[1][2]
    assert len(result.excluded) == 1


def test_unreadable_optional_fields_keep_the_answer():
    result = normalize([row(2, age="ひみつ", again="たぶん", date="きのう")], 2026)
    assert len(result.responses) == 1
    r = result.responses[0]
    assert (r.age, r.again, r.date, r.satisfaction) == ("不明", "未回答", None, 5)
    assert len(result.issues) == 3 and not result.excluded


def test_date_outside_target_month_is_flagged():
    result = normalize([row(2, date="2025/12/31")], 2026, 10)
    assert len(result.responses) == 1
    assert "対象の月（2026年10月）以外" in result.issues[0].reason


def test_personal_info_in_comment_is_flagged_and_masked():
    result = normalize([row(2, comment="折り返しください 090-0000-0000 / a.b@example.com")], 2026)
    assert "電話番号・メールアドレス" in result.issues[0].reason
    assert mask_personal(result.responses[0].comment) == "折り返しください （電話番号） / （メールアドレス）"
