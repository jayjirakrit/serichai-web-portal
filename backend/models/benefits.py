from typing import Literal

from models.common import CamelModel, FileAttachment

ExceptionCategory = Literal["missingRequiredField", "duplicateEmployeeId"]


class ExceptionEntry(CamelModel):
    category: ExceptionCategory
    employee_id: str | None = None
    employee_name: str | None = None
    detail: str


class CalculationSummary(CamelModel):
    total_employees_out: int
    computed_count: int
    resigned_flagged_count: int
    exception_count: int
    exceptions_by_category: dict[str, int]


class CalculateBenefitsResponse(CamelModel):
    summary: CalculationSummary
    exceptions: list[ExceptionEntry]
    employee_benefits_report: FileAttachment
    exception_report: FileAttachment
