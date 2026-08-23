from typing import Literal

from models.common import CamelModel, FileAttachment

ReconciliationStatus = Literal["discrepancy", "unrecognizedDepartment", "dataError"]


class ReconciliationEntry(CamelModel):
    department: str
    employee_id: str | None = None
    employee_name: str | None = None
    stated_amount: float | None = None
    recalculated_amount: float | None = None
    variance: float | None = None
    status: ReconciliationStatus
    detail: str


class ReconciliationSummary(CamelModel):
    total_employees_reconciled: int
    matched_count: int
    discrepancy_count: int
    discrepancies_by_department: dict[str, int]


class ReconcilePayrollResponse(CamelModel):
    summary: ReconciliationSummary
    discrepancies: list[ReconciliationEntry]
    reconciliation_report: FileAttachment
    discrepancy_report: FileAttachment | None = None
