from datetime import date

from util.be_dates import benefit_year_end_date, correct_be_year, retirement_date


def test_benefit_year_end_date_is_31_dec_of_cycle_be_year():
    assert benefit_year_end_date(2569) == date(2569, 12, 31)


def test_retirement_date_is_date_of_birth_plus_60_years():
    dob = date(2510, 5, 20)
    assert retirement_date(dob) == date(2570, 5, 20)


def test_benefit_year_boundary_in_leap_year_retirement_date():
    leap_dob = date(2508, 2, 29)  # 2508 -> Gregorian 1965, not itself a leap year in BE-numeric terms
    result = retirement_date(leap_dob)
    assert result.year == 2568
    assert result.month == 2
    assert result.day in (28, 29)


def test_correct_be_year_fixes_a_be_mislabeled_year():
    be_mislabeled_dob = date(2497, 3, 26)
    reference_date = date(2026, 9, 18)
    assert correct_be_year(be_mislabeled_dob, reference_date) == date(1954, 3, 26)


def test_correct_be_year_leaves_a_genuine_gregorian_year_unchanged():
    genuine_dob = date(1990, 5, 20)
    reference_date = date(2026, 9, 18)
    assert correct_be_year(genuine_dob, reference_date) == genuine_dob


def test_correct_be_year_boundary_dob_year_equals_reference_year_is_uncorrected():
    dob = date(2026, 1, 1)
    reference_date = date(2026, 9, 18)
    assert correct_be_year(dob, reference_date) == dob
