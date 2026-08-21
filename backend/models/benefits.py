from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

ExceptionCategory = Literal["missingRequiredField", "duplicateEmployeeId"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


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


class FileAttachment(CamelModel):
    filename: str
    content_base64: str


class CalculateBenefitsResponse(CamelModel):
    summary: CalculationSummary
    exceptions: list[ExceptionEntry]
    employee_benefits_report: FileAttachment
    exception_report: FileAttachment
