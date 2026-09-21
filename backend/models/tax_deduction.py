from datetime import date

from models.common import CamelModel, FileAttachment


class TaxDeductionEmployeeResult(CamelModel):
    seq: int
    id_card_number: str | None = None
    prefix: str
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    age: int | None = None
    average_monthly_salary: float | None = None
    eligible: bool
    rank: int | None = None
    selected: bool
    monthly_amounts: list[float]
    total_amount: float


class TaxDeductionSummary(CamelModel):
    reference_date: date
    total_headcount: int
    eligible_count: int
    headcount_cap: int
    selected_count: int
    age_threshold: int
    salary_cap_per_month: float
    headcount_cap_percent: float
    headcount_cap_rounding: str
    be_year_offset: int


class CalculateTaxDeductionResponse(CamelModel):
    summary: TaxDeductionSummary
    employees: list[TaxDeductionEmployeeResult]
    tax_deduction_report: FileAttachment
