from datetime import date
from typing import Literal

from models.common import CamelModel, FileAttachment

BonusExceptionCategory = Literal[
    "evaluationNotFound",
    "evaluationAllBlank",
    "leaveNotFound",
    "previousBonusNotFound",
    "otCategoryUnrecognized",
    "duplicateName",
    "workingDayDataInvalid",
]


class EmployeeBonusRecord(CamelModel):
    employee_id: str | None = None
    match_key: str
    prefix: str | None = None
    first_name: str
    last_name: str
    department_notes: str | None = None
    ot_category_code: str | None = None
    pay_rate: float | None = None
    start_date: date | None = None
    work_days: float | None = None
    total_ot: float | None = None
    total_not_worked: float | None = None
    sick_leave_days: float | None = None
    personal_leave_days: float | None = None
    special_personal_leave_days: float | None = None
    absent_days: float | None = None
    vacation_days: float | None = None
    current_grade_numeric: float | None = None
    current_grade_letter: str | None = None
    previous_grade_letter: str | None = None
    previous_bonus: float | None = None
    personal_leave_score: float | None = None
    sick_leave_score: float | None = None
    absent_score: float | None = None
    vacation_score: float | None = None
    working_days_score: float | None = None
    ot_score: float | None = None
    total_score: float | None = None
    provisional_days: float | None = None
    provisional_bonus: float | None = None
    exceptions: list[BonusExceptionCategory] = []
    exception_note: str | None = None


class BonusCalculationSummary(CamelModel):
    total_employees: int
    calculated_count: int
    exception_count: int
    exceptions_by_category: dict[str, int]


class CalculateBonusResponse(CamelModel):
    summary: BonusCalculationSummary
    flagged_employees: list[EmployeeBonusRecord]
    bonus_report: FileAttachment
