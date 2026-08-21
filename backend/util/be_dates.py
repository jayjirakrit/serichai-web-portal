from datetime import date, datetime
from typing import Union

DateLike = Union[date, datetime]


def _to_date(value: DateLike) -> date:
    if isinstance(value, datetime):
        return value.date()
    return value


def benefit_year_end_date(cycle_be_year: int) -> date:
    """31 Dec of the given BE cycle year (numeric BE year, no Gregorian conversion)."""
    return date(cycle_be_year, 12, 31)


def retirement_date(date_of_birth: DateLike) -> date:
    """Date of birth + 60 years, BE-numeric-safe (matches the existing
    accounts_service.py placeholder logic).
    """
    dob = _to_date(date_of_birth)
    target_year = dob.year + 60
    try:
        return dob.replace(year=target_year)
    except ValueError:
        # 29 Feb in a non-leap target year.
        return dob.replace(year=target_year, day=28)
