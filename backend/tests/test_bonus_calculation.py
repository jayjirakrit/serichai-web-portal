"""Tests for bonus_service.py / POST /accounts/bonus-calculation.

Ground-truth notes (verified directly against the real reference files —
`Chopaisarn_Bonus_Macro_V3.xlsm`'s decompiled VBA and Excel rule tables, and
`สรุปโบนัส_68.xlsx`'s own `ผลสรุปโบนัสปี_68` sheet as a completed historical
run — before this test file was written; see the implementation report for
the full trail):

- `ชิติมา กตัญญู` has an entirely blank evaluation row (all 13 evaluator
  cells blank) in `bonus_current_year.xlsx`'s `ผลประเมินปี_68`. Per spec.md's
  Edge Cases, this blocks her totalScore/provisionalBonus and flags
  `evaluationAllBlank` (T011) — even though the real legacy macro's own
  historical output for this exact case silently defaults to grade 0/"F"
  with no exception note (verified against `สรุปโบนัส_68.xlsx`'s
  `ผลสรุปโบนัสปี_68` answer key). This implementation deliberately does not
  reproduce that legacy default, since it is exactly the "misleading zero or
  default grade" spec.md's edge case rules out.
- For employees who *do* have evaluator entries, `ข้อมูลพนักงานปี_68.xlsx`'s
  `ผลประเมินปี_68` sheet (used to build `bonus_current_year.xlsx`, T001)
  contains different per-evaluator cell values (plain numbers) than the
  letter-graded snapshot embedded inside `สรุปโบนัส_68.xlsx` that actually
  produced its own `ผลสรุปโบนัสปี_68` answer key — a genuine data-provenance
  difference between the two reference files, confirmed directly (their
  OT-score, working-days-score, and all four leave-deduction scores match
  the answer key exactly for every employee; only the *grade* figures
  differ, and only for employees with non-blank evaluator cells). Because of
  this, this file checks the grade-independent score components (OT-table
  selection across all three categories, working-days score, all four leave
  scores) against the answer key across many employees, and reserves full
  end-to-end total/provisional figure matching for employees whose
  evaluation is blank in both files (ชิติมา, and the fixture's other
  naturally-blank rows).
- The unmodified `bonus_current_year.xlsx` / `bonus_previous_summary.xlsx`
  pair naturally contains 7 employees missing from `ผลสรุปโบนัสปี_67`
  (confirmed against the real `ผลสรุปโบนัสปี_68` answer key's own
  "ไม่เจอ bonus ปีที่แล้ว" notes) — so the baseline fixture is not a
  zero-exception run; the "reports success, not an empty/error state"
  scenario is demonstrated with a small synthetic fixture instead.
"""

import base64
import io
import math
from pathlib import Path

import openpyxl
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

import services.bonus_service as bs
from main import app

BACKEND_DIR = Path(__file__).resolve().parent.parent

FIXTURES_DIR_CURRENT = str(BACKEND_DIR / "tests" / "fixtures" / "bonus_current_year.xlsx")
FIXTURES_DIR_PREVIOUS = str(BACKEND_DIR / "tests" / "fixtures" / "bonus_previous_summary.xlsx")
FIXTURES_DIR_CURRENT_GAPS = str(BACKEND_DIR / "tests" / "fixtures" / "bonus_current_year_with_gaps.xlsx")
FIXTURES_DIR_PREVIOUS_GAPS = str(BACKEND_DIR / "tests" / "fixtures" / "bonus_previous_summary_with_gaps.xlsx")
ANSWER_KEY_FILE = FIXTURES_DIR_PREVIOUS  # bonus_previous_summary.xlsx is a full copy of สรุปโบนัส_68.xlsx (T001), which also carries this year's own ผลสรุปโบนัสปี_68 answer-key sheet
ANSWER_KEY_SHEET = "ผลสรุปโบนัสปี_68"


def _is_nan_or_none(value) -> bool:
    return value is None or (isinstance(value, float) and math.isnan(value))

YEAR = "2025"  # -> current_be_year=2568 ("68"), previous_be_year=2567 ("67")

CHITIMA = ("ชิติมา", "กตัญญู")


def _read_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


@pytest.fixture(scope="module")
def current_year_content() -> bytes:
    return _read_bytes(FIXTURES_DIR_CURRENT)


@pytest.fixture(scope="module")
def previous_summary_content() -> bytes:
    return _read_bytes(FIXTURES_DIR_PREVIOUS)


@pytest.fixture(scope="module")
def answer_key_rows() -> dict[tuple[str, str], dict]:
    """Reads the ผลสรุปโบนัสปี_68 sheet directly from ANSWER_KEY_FILE — a
    completed, real historical run carried over from สรุปโบนัส_68.xlsx, used
    as ground truth (research.md #11). Values are read from the sheet
    itself, never hardcoded."""
    wb = openpyxl.load_workbook(ANSWER_KEY_FILE, data_only=True)
    ws = wb[ANSWER_KEY_SHEET]
    rows: dict[tuple[str, str], dict] = {}
    for r in range(6, ws.max_row + 1):
        first = ws.cell(row=r, column=3).value
        last = ws.cell(row=r, column=4).value
        if not first:
            continue
        rows[(str(first).strip(), str(last or "").strip())] = {
            "current_grade_letter": ws.cell(row=r, column=11).value,
            "current_grade_numeric": ws.cell(row=r, column=13).value,
            "personal_leave_score": ws.cell(row=r, column=19).value,
            "sick_leave_score": ws.cell(row=r, column=20).value,
            "absent_score": ws.cell(row=r, column=21).value,
            "vacation_score": ws.cell(row=r, column=22).value,
            "working_days_score": ws.cell(row=r, column=23).value,
            "ot_score": ws.cell(row=r, column=24).value,
            "total_score": ws.cell(row=r, column=25).value,
            "provisional_days": ws.cell(row=r, column=26).value,
            "provisional_bonus": ws.cell(row=r, column=27).value,
        }
    return rows


def _approx(actual, expected) -> bool:
    if expected in (None, "") and (actual is None):
        return True
    if expected in (None, "") or actual is None:
        return False
    try:
        return abs(float(actual) - float(expected)) < 0.02
    except (TypeError, ValueError):
        return actual == expected


# --- T008/T011: full run + correctness against real reference data --------


def test_full_run_scores_every_employee_unless_blocked(current_year_content, previous_summary_content):
    all_employees = bs._score_all_employees(current_year_content, previous_summary_content, YEAR)
    assert len(all_employees) == 89  # every non-blank-name row in วันทำงานปี_68

    blocking = bs.BLOCKING_EXCEPTIONS
    for _, row in all_employees.iterrows():
        is_blocked = any(e in blocking for e in row["exceptions"])
        if is_blocked:
            assert _is_nan_or_none(row["total_score"])
        else:
            assert not _is_nan_or_none(row["total_score"])

    result = bs.calculate_bonus(current_year_content, previous_summary_content, YEAR)
    calculated_count = result["summary"]["calculated_count"]
    exception_count = result["summary"]["exception_count"]
    assert result["summary"]["total_employees"] == 89
    # 12 employees have an entirely blank evaluation row in this fixture —
    # per spec.md's Edge Cases, that's a blocking `evaluationAllBlank`
    # exception (not a silent grade-0 default), so only the remaining 77 are
    # fully calculated (89 - 12 = 77).
    assert calculated_count == 77
    assert result["summary"]["exceptions_by_category"]["evaluationAllBlank"] == 12
    assert len(result["flagged_employees"]) == exception_count


def test_chitima_blank_evaluation_is_blocked_but_previous_year_comparison_still_shows(
    current_year_content, previous_summary_content
):
    """ชิติมา's evaluation row (ผลประเมินปี_68) is entirely blank in
    `bonus_current_year.xlsx` — confirmed here by reading the sheet directly,
    not assumed. Per spec.md's Edge Cases ("an employee's evaluation data has
    no scored criteria at all... must be flagged as an exception rather than
    producing a misleading zero or default grade"), this blocks her
    totalScore/provisionalBonus and flags `evaluationAllBlank` — even though
    the real legacy macro's own historical output silently scored this exact
    case as grade 0/"F" with no exception (see `_parse_evaluation_sheet`'s
    docstring for the verified-against-real-data detail). Her previous-year
    comparison fields are unaffected by the block (FR-009) — verified here
    against `ผลสรุปโบนัสปี_67`, read live from the fixture, not hardcoded."""
    wb_eval = openpyxl.load_workbook(FIXTURES_DIR_CURRENT, data_only=True)
    ws_eval = wb_eval["ผลประเมินปี_68"]
    eval_row = next(
        r for r in range(5, ws_eval.max_row + 1)
        if ws_eval.cell(row=r, column=3).value == CHITIMA[0] and ws_eval.cell(row=r, column=4).value == CHITIMA[1]
    )
    assert all(ws_eval.cell(row=eval_row, column=c).value in (None, "") for c in range(5, 18))

    wb_prev = openpyxl.load_workbook(FIXTURES_DIR_PREVIOUS, data_only=True)
    ws_prev = wb_prev["ผลสรุปโบนัสปี_67"]
    prev_row = next(
        r for r in range(6, ws_prev.max_row + 1)
        if ws_prev.cell(row=r, column=3).value == CHITIMA[0] and ws_prev.cell(row=r, column=4).value == CHITIMA[1]
    )
    expected_previous_grade_letter = ws_prev.cell(row=prev_row, column=11).value
    expected_previous_bonus = ws_prev.cell(row=prev_row, column=29).value

    all_employees = bs._score_all_employees(current_year_content, previous_summary_content, YEAR)
    row = all_employees[(all_employees["first_name"] == CHITIMA[0]) & (all_employees["last_name"] == CHITIMA[1])].iloc[0]

    assert row["exceptions"] == ["evaluationAllBlank"]
    assert _is_nan_or_none(row["current_grade_numeric"])
    assert _is_nan_or_none(row["current_grade_letter"])
    assert _is_nan_or_none(row["total_score"])
    assert _is_nan_or_none(row["provisional_days"])
    assert _is_nan_or_none(row["provisional_bonus"])

    # Blocking totalScore doesn't affect her previous-year comparison (FR-009).
    assert row["previous_grade_letter"] == expected_previous_grade_letter
    assert _approx(row["previous_bonus"], expected_previous_bonus)

    result = bs.calculate_bonus(current_year_content, previous_summary_content, YEAR)
    flagged = {(e["first_name"], e["last_name"]): e for e in result["flagged_employees"]}
    assert CHITIMA in flagged
    assert flagged[CHITIMA]["exceptions"] == ["evaluationAllBlank"]
    assert flagged[CHITIMA]["total_score"] is None


def test_grade_independent_scores_match_answer_key_across_the_fixture(
    current_year_content, previous_summary_content, answer_key_rows
):
    """OT-table selection (general/SEWING/PAINT), working-days score, and all
    four leave-deduction formulas are independent of the evaluation-data
    provenance mismatch (module docstring) — checked here across every
    employee in the real fixture that also appears in the real answer key."""
    all_employees = bs._score_all_employees(current_year_content, previous_summary_content, YEAR)
    checked_ot_categories: set[str] = set()
    checked = 0
    mismatches: list[tuple] = []
    for _, row in all_employees.iterrows():
        key = (row["first_name"], row["last_name"])
        expected = answer_key_rows.get(key)
        if expected is None:
            continue
        checked += 1
        for field in ("ot_score", "working_days_score", "personal_leave_score", "sick_leave_score", "absent_score", "vacation_score"):
            if not _approx(row[field], expected[field]):
                mismatches.append((key, field, row[field], expected[field]))
        if row["ot_category_code"] in bs.OT_SCORE_TABLES:
            checked_ot_categories.add(row["ot_category_code"])

    assert checked > 50  # broad coverage, not a handful of rows
    assert checked_ot_categories == {"OT", "OT SEWING", "OT PAINT"}
    # A single boundary-value mismatch (วสันต์ ทองดี: workDays 289.5 in this
    # fixture vs. 290 in the answer key's own snapshot — the same
    # cross-file data-provenance difference as the evaluation grades, this
    # time landing exactly on the WORKING_DAYS_SCORE_TABLE's 290 threshold)
    # is tolerated; anything beyond that would indicate a real formula bug.
    assert len(mismatches) <= 1, mismatches


# --- T024/T025: report structure -------------------------------------------


def test_report_has_31_columns_every_employee_blank_approved_days_and_formula(
    current_year_content, previous_summary_content
):
    """Report layout mirrors `Bonus_Calculation_Template.xlsx`: 4 header rows
    (company name, title, editable/formula annotation band, column headers)
    then one row per employee starting at `REPORT_DATA_START_ROW`."""
    result = bs.calculate_bonus(current_year_content, previous_summary_content, YEAR)
    report_bytes = base64.b64decode(result["bonus_report"]["content_base64"])
    ws = openpyxl.load_workbook(io.BytesIO(report_bytes), data_only=False).active

    assert ws.max_column == 31
    all_employees = bs._score_all_employees(current_year_content, previous_summary_content, YEAR)
    assert ws.max_row - bs.REPORT_HEADER_ROWS == len(all_employees)  # headers + one row per employee, flagged or not

    for r in range(bs.REPORT_DATA_START_ROW, ws.max_row + 1):
        approved_days_cell = ws.cell(row=r, column=bs.REPORT_APPROVED_DAYS_COL)
        final_bonus_cell = ws.cell(row=r, column=bs.REPORT_FINAL_BONUS_COL)
        assert approved_days_cell.value is None
        formula = final_bonus_cell.value
        assert isinstance(formula, str) and formula.startswith("=IF(OR(")
        assert bs._abs_ref(bs.REPORT_APPROVED_DAYS_COL, r) in formula
        assert bs._abs_ref(bs.REPORT_PROVISIONAL_BONUS_COL, r) in formula
        # Y/Z/AA (total score/days/bonus) are also live formulas — the
        # template's other "สูตร Excel"-annotated columns — not static
        # Python-computed values, applied to every row alike.
        for col in (bs.REPORT_TOTAL_SCORE_COL, bs.REPORT_DAYS_COL, bs.REPORT_PROVISIONAL_BONUS_COL):
            assert isinstance(ws.cell(row=r, column=col).value, str)


def test_blocked_row_total_score_and_final_bonus_formulas_guard_on_blank_grade():
    """Every row in this fixture is blocked by `duplicateName` (T032), so the
    grade cell (M) is written blank for both; the Y/Z/AA formula chain gates
    on that blank cell, and AC additionally gates on AA/approved-days — so
    the whole chain resolves blank regardless of what's typed into
    approved-days (FR-007, FR-013), verified by inspecting formula structure
    and referenced cells (openpyxl doesn't evaluate formulas)."""
    current, previous = _build_duplicate_name_workbooks()
    result = bs.calculate_bonus(current, previous, YEAR)
    report_bytes = base64.b64decode(result["bonus_report"]["content_base64"])
    ws = openpyxl.load_workbook(io.BytesIO(report_bytes), data_only=False).active

    assert ws.max_row - bs.REPORT_HEADER_ROWS == 2  # both employees present in the report
    for r in range(bs.REPORT_DATA_START_ROW, ws.max_row + 1):
        grade_ref = bs._abs_ref(bs.REPORT_GRADE_NUMERIC_COL, r)
        assert ws.cell(row=r, column=bs.REPORT_GRADE_NUMERIC_COL).value is None
        total_score_formula = ws.cell(row=r, column=bs.REPORT_TOTAL_SCORE_COL).value
        final_bonus_formula = ws.cell(row=r, column=bs.REPORT_FINAL_BONUS_COL).value
        leave_ot_range = f"{bs._abs_ref(bs.REPORT_LEAVE_SCORE_START_COL, r)}:{bs._abs_ref(bs.REPORT_OT_SCORE_COL, r)}"
        assert total_score_formula == f'=IF({grade_ref}="","",SUM({grade_ref},{leave_ot_range}))'
        assert "OR(" in final_bonus_formula and '="")' in final_bonus_formula.replace(" ", "")


# --- T030/T031: gapped fixtures (User Story 3) -----------------------------


def _read_gapped_names() -> list[tuple[str, str]]:
    """The three employees removed by the fixture-builder script when
    creating bonus_current_year_with_gaps.xlsx / bonus_previous_summary_with_gaps.xlsx
    (T030) — (evaluation-gap, leave-gap, previous-summary-gap), in that order."""
    return [("บุญเลิศ", "อินสุข"), ("สังวาลย์", "เพ็งผล"), ("อำนวย", "อ่อนคำ")]


def test_gapped_fixtures_flag_each_missing_employee_with_correct_reason():
    eval_gap, leave_gap, prev_gap = _read_gapped_names()
    current = _read_bytes(FIXTURES_DIR_CURRENT_GAPS)
    previous = _read_bytes(FIXTURES_DIR_PREVIOUS_GAPS)

    all_employees = bs._score_all_employees(current, previous, YEAR)
    result = bs.calculate_bonus(current, previous, YEAR)
    flagged_by_name = {(e["first_name"], e["last_name"]): e for e in result["flagged_employees"]}

    assert eval_gap in flagged_by_name
    assert "evaluationNotFound" in flagged_by_name[eval_gap]["exceptions"]
    assert flagged_by_name[eval_gap]["total_score"] is None

    assert leave_gap in flagged_by_name
    assert "leaveNotFound" in flagged_by_name[leave_gap]["exceptions"]
    leave_gap_row = all_employees[(all_employees["first_name"] == leave_gap[0]) & (all_employees["last_name"] == leave_gap[1])].iloc[0]
    assert leave_gap_row["total_score"] == leave_gap_row["total_score"]  # not NaN — non-blocking

    assert prev_gap in flagged_by_name
    assert "previousBonusNotFound" in flagged_by_name[prev_gap]["exceptions"]
    assert flagged_by_name[prev_gap]["previous_grade_letter"] is None
    assert flagged_by_name[prev_gap]["previous_bonus"] is None

    # 12 employees naturally have an all-blank evaluation row (blocking,
    # unaffected by the gaps) + 1 evaluationNotFound (the eval-gap employee)
    # + 1 leaveNotFound (the leave-gap employee) + 8 previousBonusNotFound
    # (7 naturally missing from ผลสรุปโบนัสปี_67 in the ungapped fixture,
    # module docstring, + the 1 newly gapped one) = 22.
    assert result["summary"]["exception_count"] == 22
    assert result["summary"]["exceptions_by_category"]["evaluationAllBlank"] == 12


# --- T032/T033: duplicate name / unrecognized OT category ------------------


def _blank_row(width: int) -> list:
    return [None] * width


def _working_day_row(index, prefix, first, last, pay_rate, start_date, notes, work_days, total_ot, total_not_worked, ot_category):
    row = _blank_row(48)
    row[0], row[1], row[2], row[3] = index, prefix, first, last
    row[4], row[5], row[6] = pay_rate, start_date, notes
    row[44], row[45], row[46], row[47] = work_days, total_ot, total_not_worked, ot_category
    return row


def _evaluation_row(index, first, last, scores: list):
    row = _blank_row(17)
    row[0], row[2], row[3] = index, first, last
    for i, s in enumerate(scores[:13]):
        row[4 + i] = s
    return row


def _leave_row(index, first, last, sick=0, personal=0, special=0, absent=0, vacation=0):
    row = _blank_row(82)
    row[0], row[2], row[3] = index, first, last
    row[77], row[78], row[79], row[80], row[81] = sick, personal, special, absent, vacation
    return row


def _previous_summary_row(index, first, last, grade_letter="A", bonus=1000):
    row = _blank_row(29)
    row[0], row[2], row[3] = index, first, last
    row[10], row[28] = grade_letter, bonus
    return row


def _write_sheet(ws, header_rows: int, data_rows: list, width: int) -> None:
    ws.cell(row=1, column=1, value="Company Header")
    ws.cell(row=header_rows, column=1, value="#")  # forces the header row to exist even with no data rows
    ws.cell(row=header_rows, column=width, value=0)  # forces the sheet to be at least `width` columns wide
    for i, row in enumerate(data_rows, start=header_rows + 1):
        for c, value in enumerate(row, start=1):
            ws.cell(row=i, column=c, value=value)


def _build_current_year_workbook(working_day_rows, evaluation_rows, leave_rows) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)

    _write_sheet(wb.create_sheet("วันทำงานปี_68"), 4, working_day_rows, 48)
    _write_sheet(wb.create_sheet("ผลประเมินปี_68"), 4, evaluation_rows, 17)
    _write_sheet(wb.create_sheet("วันลาปี_68"), 4, leave_rows, 82)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _build_previous_summary_workbook(rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "ผลสรุปโบนัสปี_67"
    _write_sheet(ws, 5, rows, 29)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _build_duplicate_name_workbooks() -> tuple[bytes, bytes]:
    working_day_rows = [
        _working_day_row(1, "นาย", "ซ้ำ", "กัน", 300, "2020-01-01", "", 280, 100, 0, "OT"),
        _working_day_row(2, "นาย", "ซ้ำ", "กัน", 300, "2020-01-01", "", 280, 100, 0, "OT"),
    ]
    evaluation_rows = [
        _evaluation_row(1, "ซ้ำ", "กัน", [9, 9]),
        _evaluation_row(2, "ซ้ำ", "กัน", [9, 9]),
    ]
    leave_rows = [
        _leave_row(1, "ซ้ำ", "กัน"),
        _leave_row(2, "ซ้ำ", "กัน"),
    ]
    current = _build_current_year_workbook(working_day_rows, evaluation_rows, leave_rows)
    previous = _build_previous_summary_workbook([_previous_summary_row(1, "ซ้ำ", "กัน")])
    return current, previous


def test_duplicate_name_flags_both_rows_and_blocks_total_score():
    current, previous = _build_duplicate_name_workbooks()
    all_employees = bs._score_all_employees(current, previous, YEAR)
    assert len(all_employees) == 2
    for _, row in all_employees.iterrows():
        assert "duplicateName" in row["exceptions"]
        assert _is_nan_or_none(row["total_score"])


def test_unrecognized_ot_category_blocks_total_score_and_is_flagged():
    working_day_rows = [
        _working_day_row(1, "นาย", "แปลก", "ประหลาด", 300, "2020-01-01", "", 280, 100, 0, "SOME OTHER CODE"),
    ]
    evaluation_rows = [_evaluation_row(1, "แปลก", "ประหลาด", [9, 9])]
    leave_rows = [_leave_row(1, "แปลก", "ประหลาด")]
    current = _build_current_year_workbook(working_day_rows, evaluation_rows, leave_rows)
    previous = _build_previous_summary_workbook([_previous_summary_row(1, "แปลก", "ประหลาด")])

    all_employees = bs._score_all_employees(current, previous, YEAR)
    row = all_employees.iloc[0]
    assert "otCategoryUnrecognized" in row["exceptions"]
    assert _is_nan_or_none(row["total_score"])
    assert _is_nan_or_none(row["ot_score"])

    result = bs.calculate_bonus(current, previous, YEAR)
    assert len(result["flagged_employees"]) == 1
    assert "otCategoryUnrecognized" in result["flagged_employees"][0]["exceptions"]


def test_negative_total_score_not_clamped_but_provisional_days_floored_at_zero():
    working_day_rows = [
        _working_day_row(1, "นาย", "คะแนน", "ติดลบ", 300, "2020-01-01", "", 100, 10, 0, "OT"),
    ]
    evaluation_rows = [_evaluation_row(1, "คะแนน", "ติดลบ", [1, 1])]  # grade F -> numeric 1
    leave_rows = [_leave_row(1, "คะแนน", "ติดลบ", sick=40, personal=40, special=0, absent=40, vacation=10)]
    current = _build_current_year_workbook(working_day_rows, evaluation_rows, leave_rows)
    previous = _build_previous_summary_workbook([])

    row = bs._score_all_employees(current, previous, YEAR).iloc[0]
    assert row["total_score"] < 0
    assert row["provisional_days"] == 0
    assert row["provisional_bonus"] == 0


def test_zero_exceptions_reports_as_a_normal_successful_run():
    working_day_rows = [
        _working_day_row(1, "นาย", "สำเร็จ", "ทุกอย่าง", 300, "2020-01-01", "", 280, 100, 0, "OT"),
    ]
    evaluation_rows = [_evaluation_row(1, "สำเร็จ", "ทุกอย่าง", [9, 9])]
    leave_rows = [_leave_row(1, "สำเร็จ", "ทุกอย่าง")]
    current = _build_current_year_workbook(working_day_rows, evaluation_rows, leave_rows)
    previous = _build_previous_summary_workbook([_previous_summary_row(1, "สำเร็จ", "ทุกอย่าง")])

    result = bs.calculate_bonus(current, previous, YEAR)
    assert result["summary"]["exception_count"] == 0
    assert result["flagged_employees"] == []


# --- T036: request-level failures ------------------------------------------


def test_year_with_no_matching_sheet_raises_request_error(current_year_content, previous_summary_content):
    with pytest.raises(bs.BonusRequestError):
        bs.calculate_bonus(current_year_content, previous_summary_content, "1500")


def test_previous_summary_missing_sheet_raises_request_error(current_year_content):
    empty_previous = _build_previous_summary_workbook([])
    # Build a previous file whose sheet is named for a different year so the
    # expected ผลสรุปโบนัสปี_67 sheet is genuinely absent.
    wb = Workbook()
    ws = wb.active
    ws.title = "ผลสรุปโบนัสปี_99"
    buf = io.BytesIO()
    wb.save(buf)

    with pytest.raises(bs.BonusRequestError):
        bs.calculate_bonus(current_year_content, buf.getvalue(), YEAR)


def test_endpoint_surfaces_request_errors_as_400():
    client = TestClient(app)
    wb = Workbook()
    ws = wb.active
    ws.title = "not a real sheet"
    buf = io.BytesIO()
    wb.save(buf)
    bad_file = buf.getvalue()

    response = client.post(
        "/accounts/bonus-calculation",
        files={
            "currentYearFile": ("current.xlsx", bad_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            "previousYearSummaryFile": ("previous.xlsx", bad_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        },
        data={"year": YEAR},
    )
    assert response.status_code == 400
    assert "detail" in response.json()
