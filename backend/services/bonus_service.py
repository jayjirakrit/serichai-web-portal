import base64
import copy
import io
from pathlib import Path

import numpy as np
import pandas as pd
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

# --- Constants -----------------------------------------------------------

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "data" / "Bonus_Calculation_Template.xlsx"

OFFICE_DEPARTMENT_MARKER = "ออฟฟิศ"

# Ascending (lower_bound, value) breakpoints, approximate ("VLOOKUP TRUE") match.
# Verified against Chopaisarn_Bonus_Macro_V3.xlsm's rule tables (research.md #7).
WORKING_DAYS_SCORE_TABLE: list[tuple[float, float]] = [
    (0, -2.0),
    (150, -1.5),
    (200, -1.0),
    (250, -0.5),
    (290, 0.0),
]

OT_GENERAL_SCORE_TABLE: list[tuple[float, float]] = [
    (0, -2.5),
    (280, -2.0),
    (480, -1.5),
    (600, -1.0),
    (700, -0.5),
    (800, 0.0),
]

OT_SEWING_SCORE_TABLE: list[tuple[float, float]] = [
    (0, -2.5),
    (600, -2.0),
    (700, -1.5),
    (800, -1.0),
    (900, -0.5),
    (1000, 0.0),
]

OT_PAINT_SCORE_TABLE: list[tuple[float, float]] = [
    (0, -2.5),
    (200, -2.0),
    (250, -1.5),
    (300, -1.0),
    (350, -0.5),
    (400, 0.0),
]

OT_SCORE_TABLES: dict[str, list[tuple[float, float]]] = {
    "OT": OT_GENERAL_SCORE_TABLE,
    "OT SEWING": OT_SEWING_SCORE_TABLE,
    "OT PAINT": OT_PAINT_SCORE_TABLE,
}

# 12-tier numeric -> letter grade (ScoreClass.GetGrade), F below 2 up to A at 12.
GRADE_LETTER_TABLE: list[tuple[float, str]] = [
    (0, "F"),
    (2, "D-"),
    (3, "D"),
    (4, "D+"),
    (5, "C-"),
    (6, "C"),
    (7, "C+"),
    (8, "B-"),
    (9, "B"),
    (10, "B+"),
    (11, "A-"),
    (12, "A"),
]

# Leave-deduction formulas (LeaveDayModule.bas): ROUNDDOWN(days/divisor,0)*-0.5 once
# `days` exceeds the free allowance, clamped at floor_cap. Personal and special-
# personal leave share one formula (research.md #7).
SICK_LEAVE_FREE_DAYS, SICK_LEAVE_DIVISOR, SICK_LEAVE_FLOOR = 3, 4, -7.0
PERSONAL_LEAVE_FREE_DAYS, PERSONAL_LEAVE_DIVISOR, PERSONAL_LEAVE_FLOOR = 4, 4, -10.0
ABSENT_FREE_DAYS, ABSENT_DIVISOR, ABSENT_FLOOR = 3, 2, -7.0

VACATION_LEAVE_SCORE_MAP: dict[int, float] = {0: 0.0, 1: 0.0, 2: 0.0, 3: -0.5, 4: -0.5, 5: -1.0, 6: -1.0}
VACATION_LEAVE_DEFAULT_SCORE = -1.0

# Evaluation-cell -> numeric-score conversion (ScoreClass.Init's `scores` dict).
# Evaluator cells in ผลประเมินปี_<YY> cols 5-17 are entered either as a raw
# numeric score or as a letter grade ("A".."F") depending on who filled them
# in; both resolve to the same scale (e.g. "B" == 9), so a cell is read as a
# number when it parses as one, else looked up by letter text.
GRADE_TEXT_TO_SCORE: dict[str, float] = {
    "A": 12.0,
    "A-": 11.0,
    "B+": 10.0,
    "B": 9.0,
    "B-": 8.0,
    "C+": 7.0,
    "C": 6.0,
    "C-": 5.0,
    "D+": 4.0,
    "D": 3.0,
    "D-": 2.0,
    "F": 1.0,
}


def _evaluation_cell_score(value) -> float | None:
    """One evaluator cell's score, or `None` for a genuinely blank cell
    (excluded from both sum and count, per VBA's `IsEmpty` check). A
    non-blank cell that isn't a number or recognized letter grade still
    counts toward the denominator but contributes 0 to the sum, mirroring
    `ConvertGradeToScore`'s default for an unrecognized grade text."""
    if pd.isna(value):
        return None
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if text == "":
        return None
    numeric = pd.to_numeric(text, errors="coerce")
    if pd.notna(numeric):
        return float(numeric)
    return GRADE_TEXT_TO_SCORE.get(text.upper(), 0.0)

# Exception categories that block totalScore/provisionalDays/provisionalBonus
# (left None) rather than produce a misleading default (research.md #8).
BLOCKING_EXCEPTIONS = {
    "evaluationNotFound",
    "evaluationAllBlank",
    "otCategoryUnrecognized",
    "duplicateName",
    "workingDayDataInvalid",
}

EXCEPTION_NOTE_TEXT: dict[str, str] = {
    "evaluationNotFound": "not found in evaluation data",
    "evaluationAllBlank": "evaluation data has no scored criteria",
    "leaveNotFound": "not found in leave data",
    "previousBonusNotFound": "not found in previous-year bonus data",
    "otCategoryUnrecognized": "overtime category not recognized",
    "duplicateName": "duplicate employee name — cannot safely match records",
    "workingDayDataInvalid": "invalid working-day pay rate data",
}

# Report layout: `Bonus_Calculation_Template.xlsx` (backend/data/) mirrors the
# real ผลสรุปโบนัสปี_<YY> sheet's 31-column, 4-header-row layout (research.md #9).
# Row 1 company name, row 2 title, row 3 annotation band, row 4 headers; data from row 5.
REPORT_HEADER_ROWS = 4
REPORT_DATA_START_ROW = REPORT_HEADER_ROWS + 1
REPORT_GRADE_LETTER_COL = 11  # K, grade<CY> — blanked when a row is blocked
REPORT_GRADE_NUMERIC_COL = 13  # M, grade — blanked when a row is blocked, gating the Y/Z/AA formula chain
REPORT_PREVIOUS_GRADE_LETTER_COL = 12  # L, grade<PY>
REPORT_LEAVE_SCORE_START_COL = 19  # S, คะแนนลากิจ+กิจพิเศษ — first of the four leave-deduction score columns
REPORT_OT_SCORE_COL = 24  # X, คะแนน OT — last column folded into the total-score SUM range
REPORT_TOTAL_SCORE_COL = 25  # Y, คะแนนทั้งหมด — formula
REPORT_DAYS_COL = 26  # Z, Days — formula
REPORT_PROVISIONAL_BONUS_COL = 27  # AA, Bonus — formula
REPORT_APPROVED_DAYS_COL = 28  # AB, วัน — blank input cell
REPORT_FINAL_BONUS_COL = 29  # AC, Bonus ที่ได้ — formula

EMPLOYEE_RECORD_FIELDS = [
    "employee_id",
    "match_key",
    "prefix",
    "first_name",
    "last_name",
    "department_notes",
    "ot_category_code",
    "pay_rate",
    "start_date",
    "work_days",
    "total_ot",
    "total_not_worked",
    "sick_leave_days",
    "personal_leave_days",
    "special_personal_leave_days",
    "absent_days",
    "vacation_days",
    "current_grade_numeric",
    "current_grade_letter",
    "previous_grade_letter",
    "previous_bonus",
    "personal_leave_score",
    "sick_leave_score",
    "absent_score",
    "vacation_score",
    "working_days_score",
    "ot_score",
    "total_score",
    "provisional_days",
    "provisional_bonus",
    "exceptions",
    "exception_note",
]


class BonusRequestError(Exception):
    """Raised when an uploaded file, the selected year, or a required sheet cannot be processed at all."""


# --- Sheet resolution & reading -----------------------------------------


def _resolve_be_years(year: str) -> tuple[int, int]:
    try:
        gregorian_year = int(str(year).strip())
    except (TypeError, ValueError) as exc:
        raise BonusRequestError(f"Invalid year '{year}' — expected a Gregorian year, e.g. '2025'.") from exc
    current_be_year = gregorian_year + 543
    previous_be_year = current_be_year - 1
    return current_be_year, previous_be_year


def _evaluation_sheet_name(be_year: int) -> str:
    return f"ผลประเมินปี_{be_year % 100:02d}"


def _working_day_sheet_name(be_year: int) -> str:
    return f"วันทำงานปี_{be_year % 100:02d}"


def _leave_sheet_name(be_year: int) -> str:
    return f"วันลาปี_{be_year % 100:02d}"


def _previous_summary_sheet_name(be_year: int) -> str:
    return f"ผลสรุปโบนัสปี_{be_year % 100:02d}"


def _read_flat_sheet(content: bytes, sheet_name: str, header_row_index: int, name_col: int = 2) -> pd.DataFrame:
    """Reads a flat, one-row-per-employee sheet (research.md #2): no
    department-header rows, header at `header_row_index` (0-based), data
    immediately after, filtered to rows with a non-blank first-name cell
    (mirrors accounts_service.read_table's blank-row filtering)."""
    try:
        raw = pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, header=None, engine="openpyxl")
    except ValueError as exc:
        raise BonusRequestError(f"Sheet '{sheet_name}' was not found in the uploaded file.") from exc
    except Exception as exc:
        raise BonusRequestError(f"Could not read sheet '{sheet_name}' — file may be empty or unreadable.") from exc
    if raw.empty or header_row_index >= len(raw):
        raise BonusRequestError(f"Sheet '{sheet_name}' is missing the expected header row.")

    data = raw.iloc[header_row_index + 1 :].reset_index(drop=True).copy()
    data.columns = range(len(data.columns))
    if data.empty:
        # Boolean-indexing a DataFrame with an empty mask drops its columns
        # entirely (a pandas quirk) — return the already-empty, correctly
        # shaped frame as-is rather than let that collapse columns to 0.
        return data
    name_mask = data[name_col].apply(lambda v: pd.notna(v) and str(v).strip() != "")
    data = data[name_mask].reset_index(drop=True)
    return data


def _clean_str(value) -> str | None:
    if pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


# --- Matching (research.md #6) ------------------------------------------


def _compute_match_key(first_name: pd.Series, last_name: pd.Series) -> pd.Series:
    fn = first_name.fillna("").astype(str).str.strip()
    ln = last_name.fillna("").astype(str).str.strip()
    key = (fn + " " + ln).str.strip()
    return key.str.replace(r"\s+", " ", regex=True)


def _flag_duplicate_match_keys(df: pd.DataFrame, key_col: str) -> pd.Series:
    counts = df[key_col].value_counts()
    return df[key_col].map(counts).fillna(0) > 1


def _round_half_away_from_zero(values: pd.Series, decimals: int) -> pd.Series:
    """Excel WorksheetFunction.Round-equivalent (round-half-away-from-zero),
    unlike pandas/numpy's default round-half-to-even — mirrors
    GradeModule.bas's `WorksheetFunction.Round(avgGrade / Count, 1)`."""
    factor = 10**decimals
    return (values * factor).apply(lambda v: np.floor(v + 0.5) if v >= 0 else np.ceil(v - 0.5)) / factor


# --- Rule-table lookups (research.md #7) ---------------------------------


def _bracket_lookup(values: pd.Series, table: list[tuple[float, float]]) -> pd.Series:
    """Excel VLOOKUP(value, table, col, TRUE)-equivalent: approximate match on
    ascending lower-bound breakpoints, returning the paired value. Reimplemented
    locally rather than imported from accounts_service.py (research.md #7)."""
    breakpoints = [t[0] for t in table]
    payouts = [t[1] for t in table]
    idx = np.searchsorted(breakpoints, values.fillna(-np.inf), side="right") - 1
    idx = np.clip(idx, 0, len(table) - 1)
    return pd.Series([payouts[i] for i in idx], index=values.index)


def _safe_grade_letter_lookup(numeric_grade: pd.Series) -> pd.Series:
    """`_bracket_lookup` on `GRADE_LETTER_TABLE`, but leaves the letter blank
    (None) for rows whose numeric grade is missing (blocked), instead of
    defaulting them into the lowest ("F") band."""
    filled = numeric_grade.fillna(-1.0)
    letters = _bracket_lookup(filled, GRADE_LETTER_TABLE)
    return letters.where(numeric_grade.notna(), None)


def _floor_division_leave_score(days: pd.Series, free_days: float, divisor: float, floor_cap: float) -> pd.Series:
    """`ROUNDDOWN(days / divisor, 0) * -0.5` once `days` exceeds `free_days`,
    clamped at `floor_cap`; NaN in, NaN out (leaveNotFound stays None)."""
    d = pd.to_numeric(days, errors="coerce")
    raw = np.floor(d / divisor) * -0.5
    within_free_allowance = (d >= 0) & (d <= free_days)
    score = raw.where(~within_free_allowance, 0.0)
    return score.clip(lower=floor_cap)


def _vacation_leave_score(days: pd.Series) -> pd.Series:
    d = pd.to_numeric(days, errors="coerce")
    conditions = [d.isin([0, 1, 2]), d.isin([3, 4])]
    choices = [0.0, -0.5]
    result = np.select(conditions, choices, default=VACATION_LEAVE_DEFAULT_SCORE)
    return pd.Series(np.where(d.isna(), np.nan, result), index=days.index)


# --- Sheet parsers (research.md #3) ---------------------------------------


def _parse_working_day_sheet(content: bytes, current_be_year: int) -> pd.DataFrame:
    sheet_name = _working_day_sheet_name(current_be_year)
    data = _read_flat_sheet(content, sheet_name, header_row_index=3)

    prefix = data[1].apply(_clean_str)
    first_name = data[2].apply(_clean_str)
    last_name = data[3].apply(_clean_str)
    pay_rate_raw = pd.to_numeric(data[4], errors="coerce")
    start_date = pd.to_datetime(data[5], errors="coerce")
    department_notes = data[6].apply(_clean_str)
    # BonusReportClass.WorkDays is `As Integer`, so the raw (often fractional)
    # cell coerces via VBA's Double->Integer, which rounds half-to-even, not
    # Excel's half-away-from-zero ROUND. Round once here, upstream of both the
    # report and CalculateWorkingDayScore, which both consume this same value.
    work_days = pd.to_numeric(data[44], errors="coerce").round()
    total_ot = pd.to_numeric(data[45], errors="coerce")
    total_not_worked = pd.to_numeric(data[46], errors="coerce")
    ot_category_code = data[47].apply(_clean_str)

    is_office = department_notes == OFFICE_DEPARTMENT_MARKER
    working_day_data_invalid = pay_rate_raw.isna() | (pay_rate_raw <= 0)
    pay_rate = pd.Series(np.where(is_office, pay_rate_raw / 30, pay_rate_raw), index=data.index)
    pay_rate = pay_rate.where(~working_day_data_invalid, np.nan)

    df = pd.DataFrame(
        {
            "prefix": prefix,
            "first_name": first_name,
            "last_name": last_name,
            "match_key": _compute_match_key(first_name, last_name),
            "department_notes": department_notes,
            "pay_rate": pay_rate,
            "start_date": start_date,
            "work_days": work_days,
            "total_ot": total_ot,
            "total_not_worked": total_not_worked,
            "ot_category_code": ot_category_code,
            "working_day_data_invalid": working_day_data_invalid.reset_index(drop=True),
        }
    )
    df["duplicate_name"] = _flag_duplicate_match_keys(df, "match_key")
    return df


def _parse_evaluation_sheet(content: bytes, current_be_year: int) -> pd.DataFrame:
    """Reads ผลประเมินปี_<YY>: averages columns E:Q (5-17, 13 evaluator cells)
    ignoring blanks into `current_grade_numeric`, rounded to 1 decimal
    (GradeModule.bas's WorksheetFunction.Round(avgGrade / Count, 1)).

    When all 13 cells are blank for a matched row, `current_grade_numeric` is
    left `null` and the row is flagged `evaluationAllBlank` (blocking, see
    `BLOCKING_EXCEPTIONS`) per spec.md's Edge Cases — deliberately deviating
    from the legacy macro, which silently defaults such rows to grade 0/"F"."""
    sheet_name = _evaluation_sheet_name(current_be_year)
    data = _read_flat_sheet(content, sheet_name, header_row_index=3)

    first_name = data[2].apply(_clean_str)
    last_name = data[3].apply(_clean_str)

    score_cols = data.loc[:, 4:16].apply(lambda col: col.map(_evaluation_cell_score))
    count = score_cols.notna().sum(axis=1)
    total = score_cols.sum(axis=1)
    denom = count.replace(0, np.nan)
    current_grade_numeric = _round_half_away_from_zero(total / denom, 1)

    df = pd.DataFrame(
        {
            "match_key": _compute_match_key(first_name, last_name),
            "current_grade_numeric": current_grade_numeric,
            "evaluation_all_blank": count == 0,
        }
    )
    df["duplicate_name"] = _flag_duplicate_match_keys(df, "match_key")
    return df


def _parse_leave_sheet(content: bytes, current_be_year: int) -> pd.DataFrame:
    sheet_name = _leave_sheet_name(current_be_year)
    data = _read_flat_sheet(content, sheet_name, header_row_index=3)

    first_name = data[2].apply(_clean_str)
    last_name = data[3].apply(_clean_str)

    df = pd.DataFrame(
        {
            "match_key": _compute_match_key(first_name, last_name),
            "sick_leave_days": pd.to_numeric(data[77], errors="coerce"),
            "personal_leave_days": pd.to_numeric(data[78], errors="coerce"),
            "special_personal_leave_days": pd.to_numeric(data[79], errors="coerce"),
            "absent_days": pd.to_numeric(data[80], errors="coerce"),
            "vacation_days": pd.to_numeric(data[81], errors="coerce"),
        }
    )
    df["duplicate_name"] = _flag_duplicate_match_keys(df, "match_key")
    return df


def _parse_previous_summary_sheet(content: bytes, previous_be_year: int) -> pd.DataFrame:
    sheet_name = _previous_summary_sheet_name(previous_be_year)
    data = _read_flat_sheet(content, sheet_name, header_row_index=4)

    first_name = data[2].apply(_clean_str)
    last_name = data[3].apply(_clean_str)

    df = pd.DataFrame(
        {
            "match_key": _compute_match_key(first_name, last_name),
            "previous_grade_letter": data[10].apply(_clean_str),
            "previous_bonus": pd.to_numeric(data[28], errors="coerce"),
        }
    )
    df["duplicate_name"] = _flag_duplicate_match_keys(df, "match_key")
    return df


# --- Joining & scoring (research.md #6, #8) -------------------------------


def _join_sources(
    working_day_df: pd.DataFrame,
    evaluation_df: pd.DataFrame,
    leave_df: pd.DataFrame,
    previous_summary_df: pd.DataFrame,
) -> pd.DataFrame:
    """Left-joins evaluation/leave/previous-summary onto the working-day base
    by `match_key`. A `match_key` colliding within a joined source (distinct
    from `duplicateName`, which flags a base-sheet collision) is treated as
    unsafe for that source: those rows are excluded before the merge, so the
    join naturally comes back not-found for them (research.md #6).

    `evaluationAllBlank` (matched, every evaluator cell blank) is distinct
    from `evaluationNotFound` (no match): after the merge, `evaluation_all_blank`
    is `NaN` for no-match rows and `True`/`False` for a matched row."""
    df = working_day_df.copy().reset_index(drop=True)

    eval_safe = evaluation_df[~evaluation_df["duplicate_name"]]
    df = df.merge(
        eval_safe[["match_key", "current_grade_numeric", "evaluation_all_blank"]],
        on="match_key",
        how="left",
    )
    evaluation_not_found = df["evaluation_all_blank"].isna()
    evaluation_all_blank = df["evaluation_all_blank"].fillna(False).astype(bool)

    leave_cols = ["sick_leave_days", "personal_leave_days", "special_personal_leave_days", "absent_days", "vacation_days"]
    leave_safe = leave_df[~leave_df["duplicate_name"]]
    df = df.merge(leave_safe[["match_key", *leave_cols]], on="match_key", how="left", indicator="_leave_merge")
    leave_not_found = df["_leave_merge"] == "left_only"
    df = df.drop(columns=["_leave_merge"])

    prev_safe = previous_summary_df[~previous_summary_df["duplicate_name"]]
    df = df.merge(
        prev_safe[["match_key", "previous_grade_letter", "previous_bonus"]],
        on="match_key",
        how="left",
        indicator="_prev_merge",
    )
    previous_bonus_not_found = df["_prev_merge"] == "left_only"
    df = df.drop(columns=["_prev_merge"])

    ot_category_unrecognized = ~df["ot_category_code"].isin(OT_SCORE_TABLES.keys())

    exceptions: list[list[str]] = []
    for i in range(len(df)):
        row_exceptions: list[str] = []
        if bool(df.at[i, "duplicate_name"]):
            row_exceptions.append("duplicateName")
        if bool(df.at[i, "working_day_data_invalid"]):
            row_exceptions.append("workingDayDataInvalid")
        if bool(ot_category_unrecognized.iat[i]):
            row_exceptions.append("otCategoryUnrecognized")
        if bool(evaluation_not_found.iat[i]):
            row_exceptions.append("evaluationNotFound")
        elif bool(evaluation_all_blank.iat[i]):
            row_exceptions.append("evaluationAllBlank")
        if bool(leave_not_found.iat[i]):
            row_exceptions.append("leaveNotFound")
        if bool(previous_bonus_not_found.iat[i]):
            row_exceptions.append("previousBonusNotFound")
        exceptions.append(row_exceptions)

    df["exceptions"] = exceptions
    return df


def _score_employees(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["current_grade_letter"] = _safe_grade_letter_lookup(df["current_grade_numeric"])

    combined_personal = df["personal_leave_days"] + df["special_personal_leave_days"]
    df["personal_leave_score"] = _floor_division_leave_score(
        combined_personal, PERSONAL_LEAVE_FREE_DAYS, PERSONAL_LEAVE_DIVISOR, PERSONAL_LEAVE_FLOOR
    )
    df["sick_leave_score"] = _floor_division_leave_score(
        df["sick_leave_days"], SICK_LEAVE_FREE_DAYS, SICK_LEAVE_DIVISOR, SICK_LEAVE_FLOOR
    )
    df["absent_score"] = _floor_division_leave_score(df["absent_days"], ABSENT_FREE_DAYS, ABSENT_DIVISOR, ABSENT_FLOOR)
    df["vacation_score"] = _vacation_leave_score(df["vacation_days"])

    df["working_days_score"] = _bracket_lookup(df["work_days"], WORKING_DAYS_SCORE_TABLE)

    ot_score = pd.Series(np.nan, index=df.index)
    for code, table in OT_SCORE_TABLES.items():
        mask = df["ot_category_code"] == code
        if mask.any():
            ot_score.loc[mask] = _bracket_lookup(df.loc[mask, "total_ot"], table)
    df["ot_score"] = ot_score

    is_blocked = df["exceptions"].apply(lambda exs: any(e in BLOCKING_EXCEPTIONS for e in exs))

    leave_score_sum = df[["personal_leave_score", "sick_leave_score", "absent_score", "vacation_score"]].fillna(0).sum(
        axis=1
    )
    total_score_raw = (
        df["current_grade_numeric"].fillna(0) + leave_score_sum + df["working_days_score"].fillna(0) + df["ot_score"].fillna(0)
    )
    df["total_score"] = total_score_raw.where(~is_blocked, np.nan)

    df["provisional_days"] = np.where(
        df["total_score"].notna(), (df["total_score"] * 30 / 12).clip(lower=0), np.nan
    )
    df["provisional_bonus"] = np.where(
        pd.notna(df["provisional_days"]) & df["pay_rate"].notna(),
        df["provisional_days"] * df["pay_rate"],
        np.nan,
    )
    return df


def _build_exception_note(exceptions: list[str]) -> str | None:
    if not exceptions:
        return None
    phrases = [EXCEPTION_NOTE_TEXT.get(e, e) for e in exceptions]
    sentence = "; ".join(phrases)
    return sentence[0].upper() + sentence[1:] + "."


# --- Internal pipeline & wire orchestrator --------------------------------


def _score_all_employees(current_year_content: bytes, previous_year_summary_content: bytes, year: str) -> pd.DataFrame:
    """Internal pipeline: scores every employee in the working-day (base)
    sheet, flagged or not. Tests call this directly to inspect non-flagged
    employees' computed scores; `calculate_bonus()` narrows its result to
    `flagged_employees` for the wire response (spec Clarifications,
    2026-08-23 (3))."""
    current_be_year, previous_be_year = _resolve_be_years(year)

    working_day_df = _parse_working_day_sheet(current_year_content, current_be_year)
    evaluation_df = _parse_evaluation_sheet(current_year_content, current_be_year)
    leave_df = _parse_leave_sheet(current_year_content, current_be_year)
    previous_summary_df = _parse_previous_summary_sheet(previous_year_summary_content, previous_be_year)

    joined = _join_sources(working_day_df, evaluation_df, leave_df, previous_summary_df)
    scored = _score_employees(joined)
    scored["exception_note"] = scored["exceptions"].apply(_build_exception_note)
    scored["employee_id"] = None
    return scored


def _clean_value(value):
    if value is None:
        return None
    if isinstance(value, float) and np.isnan(value):
        return None
    if isinstance(value, np.floating):
        return None if np.isnan(value) else float(value)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.date()
    if value is pd.NaT:
        return None
    return value


def _row_to_record_dict(row: pd.Series) -> dict:
    record = {}
    for field in EMPLOYEE_RECORD_FIELDS:
        raw = row.get(field)
        if field == "exceptions":
            record[field] = list(raw) if isinstance(raw, list) else []
            continue
        record[field] = _clean_value(raw)
    return record


def calculate_bonus(current_year_content: bytes, previous_year_summary_content: bytes, year: str) -> dict:
    current_be_year, previous_be_year = _resolve_be_years(year)
    all_employees = _score_all_employees(current_year_content, previous_year_summary_content, year)

    total_employees = len(all_employees)
    calculated_count = int(all_employees["total_score"].notna().sum())
    has_exceptions = all_employees["exceptions"].apply(lambda exs: len(exs) > 0)
    exception_count = int(has_exceptions.sum())

    exceptions_by_category: dict[str, int] = {}
    for exs in all_employees["exceptions"]:
        for e in exs:
            exceptions_by_category[e] = exceptions_by_category.get(e, 0) + 1

    flagged_employees = [_row_to_record_dict(row) for _, row in all_employees[has_exceptions].iterrows()]

    report_bytes = build_bonus_report(all_employees, current_be_year, previous_be_year)

    return {
        "summary": {
            "total_employees": total_employees,
            "calculated_count": calculated_count,
            "exception_count": exception_count,
            "exceptions_by_category": exceptions_by_category,
        },
        "flagged_employees": flagged_employees,
        "bonus_report": {
            "filename": "bonus_calculation_report.xlsx",
            "content_base64": base64.b64encode(report_bytes).decode("ascii"),
        },
    }


# --- Report generation (research.md #9, #10) ------------------------------


def _num_or_none(value):
    if value is None:
        return None
    if isinstance(value, float) and np.isnan(value):
        return None
    if isinstance(value, (np.floating, np.integer)):
        return None if pd.isna(value) else value.item()
    return value


def _abs_ref(column: int, row: int) -> str:
    return f"${get_column_letter(column)}${row}"


def _copy_cell_style(src_cell, dst_cell) -> None:
    dst_cell.font = copy.copy(src_cell.font)
    dst_cell.fill = copy.copy(src_cell.fill)
    dst_cell.border = copy.copy(src_cell.border)
    dst_cell.alignment = copy.copy(src_cell.alignment)
    dst_cell.number_format = src_cell.number_format


def build_bonus_report(all_employees_df: pd.DataFrame, current_be_year: int, previous_be_year: int) -> bytes:
    """Fills `Bonus_Calculation_Template.xlsx` (backend/data/) with one row per
    employee, reusing its 31-column layout, headers, and per-column styling
    (research.md #9). Row 5's worked-example formulas (Y/Z/AA total-score/days/
    bonus, AC final bonus) are rebuilt per row — not computed in Python — so the
    workbook stays a live spreadsheet matching the legacy report (research.md #10,
    FR-012). For a blocking exception (`BLOCKING_EXCEPTIONS`), grade cells (K/M)
    are left blank — the gate the Y formula checks — so the whole Y/Z/AA/AC chain
    resolves blank regardless of what's typed into the approved-days cell (FR-007, FR-013)."""
    wb = load_workbook(TEMPLATE_PATH)
    ws = wb.active
    ws.title = _previous_summary_sheet_name(current_be_year)
    ws.cell(row=2, column=1).value = (
        f"ผลสรุปโบนัสผลปี  {current_be_year} ( ตั้งแต่ 1 ม.ค. - 31 ธ.ค. {current_be_year})"
    )
    ws.cell(row=4, column=REPORT_GRADE_LETTER_COL).value = f"grade{current_be_year % 100:02d}"
    ws.cell(row=4, column=REPORT_PREVIOUS_GRADE_LETTER_COL).value = f"grade{previous_be_year % 100:02d}"

    template_row = REPORT_DATA_START_ROW
    template_cells = [ws.cell(row=template_row, column=c) for c in range(1, 32)]
    template_row_height = ws.row_dimensions[template_row].height

    for i, (_, row) in enumerate(all_employees_df.iterrows()):
        r = REPORT_DATA_START_ROW + i
        if r != template_row:
            for c in range(1, 32):
                _copy_cell_style(template_cells[c - 1], ws.cell(row=r, column=c))
            if template_row_height is not None:
                ws.row_dimensions[r].height = template_row_height

        is_blocked = any(e in BLOCKING_EXCEPTIONS for e in row.get("exceptions") or [])
        start_date = row.get("start_date")
        start_date_value = start_date.date() if pd.notna(start_date) else None

        ws.cell(row=r, column=1).value = None  # ลำดับ — reserved for a future employeeId, always blank in v1
        ws.cell(row=r, column=2).value = row.get("prefix")
        ws.cell(row=r, column=3).value = row.get("first_name")
        ws.cell(row=r, column=4).value = row.get("last_name")
        ws.cell(row=r, column=5).value = _num_or_none(row.get("pay_rate"))
        ws.cell(row=r, column=6).value = start_date_value
        ws.cell(row=r, column=7).value = row.get("department_notes")
        ws.cell(row=r, column=8).value = _num_or_none(row.get("work_days"))
        ws.cell(row=r, column=9).value = _num_or_none(row.get("total_ot"))
        ws.cell(row=r, column=10).value = _num_or_none(row.get("total_not_worked"))
        ws.cell(row=r, column=REPORT_GRADE_LETTER_COL).value = None if is_blocked else row.get("current_grade_letter")
        ws.cell(row=r, column=REPORT_PREVIOUS_GRADE_LETTER_COL).value = row.get("previous_grade_letter")
        ws.cell(row=r, column=REPORT_GRADE_NUMERIC_COL).value = (
            None if is_blocked else _num_or_none(row.get("current_grade_numeric"))
        )
        ws.cell(row=r, column=14).value = _num_or_none(row.get("personal_leave_days"))
        ws.cell(row=r, column=15).value = _num_or_none(row.get("sick_leave_days"))
        ws.cell(row=r, column=16).value = _num_or_none(row.get("special_personal_leave_days"))
        ws.cell(row=r, column=17).value = _num_or_none(row.get("absent_days"))
        ws.cell(row=r, column=18).value = _num_or_none(row.get("vacation_days"))
        ws.cell(row=r, column=19).value = _num_or_none(row.get("personal_leave_score"))
        ws.cell(row=r, column=20).value = _num_or_none(row.get("sick_leave_score"))
        ws.cell(row=r, column=21).value = _num_or_none(row.get("absent_score"))
        ws.cell(row=r, column=22).value = _num_or_none(row.get("vacation_score"))
        ws.cell(row=r, column=23).value = _num_or_none(row.get("working_days_score"))
        ws.cell(row=r, column=REPORT_OT_SCORE_COL).value = _num_or_none(row.get("ot_score"))

        grade_ref = _abs_ref(REPORT_GRADE_NUMERIC_COL, r)
        pay_rate_ref = _abs_ref(5, r)
        leave_ot_score_range = f"{_abs_ref(REPORT_LEAVE_SCORE_START_COL, r)}:{_abs_ref(REPORT_OT_SCORE_COL, r)}"
        total_score_ref = _abs_ref(REPORT_TOTAL_SCORE_COL, r)
        days_ref = _abs_ref(REPORT_DAYS_COL, r)
        provisional_bonus_ref = _abs_ref(REPORT_PROVISIONAL_BONUS_COL, r)
        approved_days_ref = _abs_ref(REPORT_APPROVED_DAYS_COL, r)

        ws.cell(row=r, column=REPORT_TOTAL_SCORE_COL).value = (
            f'=IF({grade_ref}="","",SUM({grade_ref},{leave_ot_score_range}))'
        )
        ws.cell(row=r, column=REPORT_DAYS_COL).value = (
            f'=IF({total_score_ref}="","",IF({total_score_ref}*30/12<=0,0,{total_score_ref}*30/12))'
        )
        ws.cell(row=r, column=REPORT_PROVISIONAL_BONUS_COL).value = f'=IF({days_ref}="","",{days_ref}*{pay_rate_ref})'
        ws.cell(row=r, column=REPORT_APPROVED_DAYS_COL).value = None  # วัน — blank input cell (FR-012)
        ws.cell(row=r, column=REPORT_FINAL_BONUS_COL).value = (
            f'=IF(OR({provisional_bonus_ref}="",{approved_days_ref}=""),"",'
            f"ROUND({approved_days_ref}*{provisional_bonus_ref}/30,0))"
        )
        ws.cell(row=r, column=30).value = _num_or_none(row.get("previous_bonus"))
        ws.cell(row=r, column=31).value = row.get("exception_note")

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
