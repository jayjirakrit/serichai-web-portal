"""Tests for tax_deduction_service.py (specs/006-elderly-tax-deduction).

T010 exercises `calculate()` with small, in-memory synthetic DataFrames (no
file I/O, per the feature's NFR that the calculation core be pure and
independently unit-testable). T012 runs the real fixture roster through the
full `read_input -> calculate -> fill_output_workbook` pipeline and checks
the result against the static `TEMPLATE_PATH` output template.
"""

import base64
import io
from datetime import date
from pathlib import Path

import openpyxl
import pandas as pd
from fastapi.testclient import TestClient

from main import app
from services import tax_deduction_service
from services.tax_deduction_service import (
    TEMPLATE_PATH,
    calculate,
    calculate_tax_deduction,
    fill_output_workbook,
    read_input,
)

BACKEND_DIR = Path(__file__).resolve().parent.parent
FIXTURE_ROSTER = BACKEND_DIR / "tests" / "fixtures" / "tax_deduction_roster.xlsx"
FIXTURE_ROSTER_MALFORMED = BACKEND_DIR / "tests" / "fixtures" / "tax_deduction_roster_malformed.xlsx"

REFERENCE_DATE = date(2026, 9, 18)

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _make_roster(rows: list[dict]) -> pd.DataFrame:
    """Builds a synthetic working DataFrame matching `read_roster()`'s output
    schema, so `calculate()` can be exercised without any file I/O."""
    records = []
    for row in rows:
        monthly = row.get("monthly_net", {})
        default_net = row.get("default_monthly_net")
        record = {
            "seq": row["seq"],
            "id_card_number": row.get("id_card_number", f"ID{row['seq']:03d}"),
            "prefix": row.get("prefix", "นาย"),
            "first_name": row.get("first_name", f"Employee{row['seq']}"),
            "last_name": row.get("last_name", "Test"),
            "base_wage_rate": row.get("base_wage_rate", 10000.0),
            "date_of_birth_raw": pd.Timestamp(row["date_of_birth"]),
        }
        for m in range(1, 13):
            record[f"monthly_net_{m}"] = monthly.get(m, default_net)
        records.append(record)
    return pd.DataFrame.from_records(records)


def _young_filler_rows(seqs: list[int]) -> list[dict]:
    """Rows guaranteed ineligible by age (used purely to pad total
    headcount so a specific `HEADCOUNT_CAP_PERCENT` outcome is exercised)."""
    return [
        {"seq": s, "date_of_birth": date(1990, 1, 1), "default_monthly_net": 8000.0}
        for s in seqs
    ]


# --- T010: calculate() -------------------------------------------------


def test_be_corrected_age_drives_eligibility():
    # Raw DOB year 2497 is Buddhist-Era-mislabeled for Gregorian 1954; if left
    # uncorrected the age would be nonsensical (deeply negative) and the
    # employee would never be eligible.
    roster = _make_roster(
        [{"seq": 1, "date_of_birth": date(2497, 3, 26), "default_monthly_net": 10000.0}]
    )
    result = calculate(roster, REFERENCE_DATE)

    assert result.loc[0, "date_of_birth"] == date(1954, 3, 26)
    assert result.loc[0, "age"] == 72
    assert result.loc[0, "eligible"] == True  # noqa: E712 (numpy bool)


def test_partial_year_averaging_divides_by_populated_months_not_12():
    roster = _make_roster(
        [
            {
                "seq": 1,
                "date_of_birth": date(1960, 1, 1),  # age > 60, genuine Gregorian
                "monthly_net": {1: 14000.0, 2: 14000.0, 3: 14000.0, 4: 14000.0, 5: 14000.0},
                # months 6-12 left unpopulated (NaN)
            }
        ]
    )
    result = calculate(roster, REFERENCE_DATE)

    assert result.loc[0, "average_monthly_net_salary"] == 14000.0
    assert result.loc[0, "eligible"] == True  # noqa: E712


def test_month_over_salary_cap_reads_zero_for_only_that_month():
    # Ten rows so the 10%-of-headcount cap floors to exactly 1, and only one
    # employee is eligible -> guaranteed selected.
    target = {
        "seq": 1,
        "date_of_birth": date(1960, 1, 1),  # age > 60
        "monthly_net": {m: 10000.0 for m in range(1, 13)} | {6: 20000.0},  # June spikes over cap
    }
    rows = [target, *_young_filler_rows(list(range(2, 11)))]
    roster = _make_roster(rows)
    result = calculate(roster, REFERENCE_DATE)

    row = result.loc[result["seq"] == 1].iloc[0]
    assert row["eligible"] == True  # noqa: E712
    assert row["selected"] == True  # noqa: E712
    assert row["monthly_deduction_6"] == 0.0
    for m in range(1, 13):
        if m != 6:
            assert row[f"monthly_deduction_{m}"] == 10000.0
    assert row["total_deduction"] == 10000.0 * 11


def test_tied_average_salary_ordered_by_ascending_seq():
    tied_a = {"seq": 1, "date_of_birth": date(1960, 1, 1), "default_monthly_net": 14000.0}
    tied_b = {"seq": 2, "date_of_birth": date(1960, 1, 1), "default_monthly_net": 14000.0}
    rows = [tied_a, tied_b, *_young_filler_rows(list(range(3, 11)))]
    roster = _make_roster(rows)
    result = calculate(roster, REFERENCE_DATE)

    row1 = result.loc[result["seq"] == 1].iloc[0]
    row2 = result.loc[result["seq"] == 2].iloc[0]
    assert row1["rank"] == 1
    assert row2["rank"] == 2
    assert row1["selected"] == True  # noqa: E712
    assert row2["selected"] == False  # noqa: E712


def test_headcount_cap_rounds_to_zero_yields_eligible_but_not_selected():
    # Five employees -> floor(5 * 0.10) == 0: no one can be selected even
    # though every one of them individually passes age/salary.
    rows = [
        {"seq": s, "date_of_birth": date(1960, 1, 1), "default_monthly_net": 10000.0}
        for s in range(1, 6)
    ]
    roster = _make_roster(rows)
    result = calculate(roster, REFERENCE_DATE)

    assert (result["eligible"] == True).all()  # noqa: E712
    assert (result["selected"] == False).all()  # noqa: E712


# --- T012: fill_output_workbook() round trip ----------------------------

ROSTER_SHEET_NAME = "ข้อมูลพนักงาน"
OUTPUT_SHEET_NAME = "ผลประโยช์นพนักงาน"


def test_fill_output_workbook_uses_static_template_and_matches_calculate():
    """fill_output_workbook() now fills the static `TEMPLATE_PATH` output
    template (research.md #6, revised) rather than the uploaded workbook --
    matching accounts_service.py/bonus_service.py's static-template
    convention. The uploaded roster is never echoed back into the report."""
    content = FIXTURE_ROSTER.read_bytes()

    template_wb = openpyxl.load_workbook(TEMPLATE_PATH)
    template_ws = template_wb.active
    original_title_values = [
        [template_ws.cell(row=r, column=c).value for c in range(1, template_ws.max_column + 1)]
        for r in range(1, 5)
    ]

    roster = read_input(content)
    results = calculate(roster, REFERENCE_DATE)
    attachment = fill_output_workbook(results)

    decoded = base64.b64decode(attachment.content_base64)
    report_wb = openpyxl.load_workbook(io.BytesIO(decoded))

    # Template-based report: no roster sheet, single (renamed) output sheet.
    assert report_wb.sheetnames == [OUTPUT_SHEET_NAME]
    out_ws = report_wb[OUTPUT_SHEET_NAME]

    # Rows 1-4 (title block + header) come from the template, unmodified.
    report_title_values = [
        [out_ws.cell(row=r, column=c).value for c in range(1, out_ws.max_column + 1)]
        for r in range(1, 5)
    ]
    assert report_title_values == original_title_values

    # Written data rows must match calculate()'s own output exactly.
    header_row = [out_ws.cell(row=4, column=c).value for c in range(1, out_ws.max_column + 1)]
    month_cols = {
        name: header_row.index(name) + 1
        for name in ["ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค"]
    }
    col_seq = header_row.index("ลำดับ") + 1
    col_salary = header_row.index("เงินเดือน") + 1
    col_dob = header_row.index("วันเดือนปีเกิด") + 1
    col_age = header_row.index("อายุปัจจุบัน") + 1
    col_total = header_row.index("รวม") + 1

    for _, row in results.iterrows():
        r = 5 + int(row["seq"]) - 1
        assert out_ws.cell(row=r, column=col_seq).value == int(row["seq"])
        assert out_ws.cell(row=r, column=col_salary).value == row["average_monthly_net_salary"]
        assert out_ws.cell(row=r, column=col_dob).value.date() == row["date_of_birth"]
        assert out_ws.cell(row=r, column=col_age).value == int(row["age"])
        for month_index, name in enumerate(
            ["ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค"], start=1
        ):
            assert out_ws.cell(row=r, column=month_cols[name]).value == row[f"monthly_deduction_{month_index}"]
        assert out_ws.cell(row=r, column=col_total).value == row["total_deduction"]


# --- T013: POST /accounts/tax-deduction integration tests ------------------


def test_endpoint_returns_200_with_decodable_filled_workbook():
    client = TestClient(app)
    content = FIXTURE_ROSTER.read_bytes()

    response = client.post(
        "/accounts/tax-deduction",
        files={"payrollFile": ("tax_deduction_roster.xlsx", content, XLSX_CONTENT_TYPE)},
    )

    assert response.status_code == 200
    body = response.json()
    report = body["taxDeductionReport"]
    assert report["filename"] == "tax_deduction_report.xlsx"

    decoded = base64.b64decode(report["contentBase64"])
    wb = openpyxl.load_workbook(io.BytesIO(decoded))
    # Template-based report: only the (renamed) output sheet, no roster sheet.
    assert wb.sheetnames == [OUTPUT_SHEET_NAME]


def test_endpoint_returns_400_naming_missing_sheet_for_malformed_upload():
    # Output is now a static template (fill_output_workbook no longer reads
    # or validates the upload's own output sheet), so the only remaining
    # malformed-upload case is a missing/broken roster sheet -- the fixture
    # is the good roster with `ข้อมูลพนักงาน` deleted (research.md #6 revised).
    client = TestClient(app)
    content = FIXTURE_ROSTER_MALFORMED.read_bytes()

    response = client.post(
        "/accounts/tax-deduction",
        files={"payrollFile": ("tax_deduction_roster_malformed.xlsx", content, XLSX_CONTENT_TYPE)},
    )

    assert response.status_code == 400
    assert ROSTER_SHEET_NAME in response.json()["detail"]


def test_endpoint_returns_422_when_payroll_file_missing():
    client = TestClient(app)

    response = client.post("/accounts/tax-deduction", data={})

    assert response.status_code == 422


# --- T018: employees list ordering and FR-014 three-state shapes -----------
#
# Confirmed against tax_deduction_roster.xlsx via calculate() at REFERENCE_DATE
# (2026-09-18): seq 1 is the sole selected row (rank 1, headcount_cap =
# floor(10 * 0.10) == 1); seq 2 (rank 2), seq 3 (rank 4), and seq 6 (rank 3,
# a partial-year new hire with only months 8-12 populated) are eligible but
# excluded beyond the cap; seq 4 fails on age alone (55, salary 10000 is
# under the cap); seq 5 fails on salary alone (65, but salary 20000 is over
# the cap).


def test_employees_list_is_full_roster_sorted_by_total_deduction_with_three_states_shaped_correctly():
    content = FIXTURE_ROSTER.read_bytes()
    result = calculate_tax_deduction(content, REFERENCE_DATE)
    employees = result["employees"]

    # Full roster (not eligible-only), sorted by total_amount descending,
    # ties (everyone but seq 1 has an all-zero year) broken by ascending seq.
    assert {e["seq"] for e in employees} == set(range(1, 11))
    totals = [e["total_amount"] for e in employees]
    assert totals == sorted(totals, reverse=True)
    tied_seqs = [e["seq"] for e, total in zip(employees, totals) if total == 0.0]
    assert tied_seqs == sorted(tied_seqs)
    assert employees[0]["seq"] == 1  # the sole selected employee, highest total

    by_seq = {e["seq"]: e for e in employees}

    # Not-eligible state: age-ineligible (seq 4) and salary-ineligible (seq 5).
    for seq in (4, 5):
        row = by_seq[seq]
        assert row["eligible"] is False
        assert row["rank"] is None
        assert row["monthly_amounts"] == [0.0] * 12
        assert row["age"] is not None
        assert row["average_monthly_salary"] is not None

    # Eligible-but-excluded state: beyond the headcount cap.
    for seq in (2, 3, 6):
        row = by_seq[seq]
        assert row["eligible"] is True
        assert row["selected"] is False
        assert row["rank"] is not None and row["rank"] > 0
        assert row["monthly_amounts"] == [0.0] * 12

    # Selected state: non-zero amounts for every populated month.
    selected = by_seq[1]
    assert selected["eligible"] is True
    assert selected["selected"] is True
    assert selected["rank"] is not None and selected["rank"] > 0
    assert all(amount > 0 for amount in selected["monthly_amounts"])


# --- T020: summary rule constants and reference-date sensitivity -----------


def test_summary_rule_constants_match_service_module_constants():
    content = FIXTURE_ROSTER.read_bytes()
    result = calculate_tax_deduction(content, REFERENCE_DATE)
    summary = result["summary"]

    assert summary["age_threshold"] == tax_deduction_service.AGE_THRESHOLD
    assert summary["salary_cap_per_month"] == tax_deduction_service.SALARY_CAP
    assert summary["headcount_cap_percent"] == tax_deduction_service.HEADCOUNT_CAP_PERCENT
    assert summary["headcount_cap_rounding"] == tax_deduction_service.HEADCOUNT_CAP_ROUNDING
    assert summary["be_year_offset"] == tax_deduction_service.BE_YEAR_OFFSET


def test_different_reference_date_flips_age_eligibility_and_echoes_in_summary():
    # seq 1 (DOB 1961-01-15) sits exactly on the age threshold two days
    # apart: 2022-01-14 -> age 60 (not eligible), 2022-01-16 -> age 61
    # (eligible) -- confirmed directly against calculate() beforehand.
    content = FIXTURE_ROSTER.read_bytes()
    before_60th_birthday = date(2022, 1, 14)
    after_60th_birthday = date(2022, 1, 16)

    result_before = calculate_tax_deduction(content, before_60th_birthday)
    result_after = calculate_tax_deduction(content, after_60th_birthday)

    # The summary echoes back whichever reference date drove the run.
    assert result_before["summary"]["reference_date"] == before_60th_birthday
    assert result_after["summary"]["reference_date"] == after_60th_birthday

    seq1_before = next(e for e in result_before["employees"] if e["seq"] == 1)
    seq1_after = next(e for e in result_after["employees"] if e["seq"] == 1)

    # The same reference-date change drives both the echoed summary date and
    # the actual computed age/eligibility, consistently with each other.
    assert seq1_before["age"] == 60
    assert seq1_before["eligible"] is False
    assert seq1_after["age"] == 61
    assert seq1_after["eligible"] is True
