from datetime import date

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

import services.accounts_service as accounts_service
import services.bonus_service as bonus_service
import services.payroll_reconcile_service as payroll_reconcile_service
import services.tax_deduction_service as tax_deduction_service
from models.benefits import CalculateBenefitsResponse
from models.bonus import CalculateBonusResponse
from models.payroll import ReconcilePayrollResponse
from models.tax_deduction import CalculateTaxDeductionResponse

router = APIRouter(
    prefix="/accounts",
    tags=["Accounts"]
)


@router.post("/employee-benefits", response_model=CalculateBenefitsResponse)
async def calculate_employee_benefits(
    masterFile: UploadFile = File(...),
    previousBenefitsFile: UploadFile | None = File(None),
):
    master_content = await masterFile.read()
    previous_content = await previousBenefitsFile.read() if previousBenefitsFile else None

    try:
        result = accounts_service.calculate_benefits(
            master_content=master_content,
            master_filename=masterFile.filename or "master.xlsx",
            previous_content=previous_content,
            previous_filename=previousBenefitsFile.filename if previousBenefitsFile else None,
        )
    except accounts_service.BenefitsRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CalculateBenefitsResponse(**result)


@router.post("/payroll-reconcile", response_model=ReconcilePayrollResponse)
async def reconcile_payroll(
    payrollFile: UploadFile = File(...),
    period: str = Form(...),
):
    payroll_content = await payrollFile.read()

    try:
        result = payroll_reconcile_service.reconcile_payroll(
            payroll_content=payroll_content,
            payroll_filename=payrollFile.filename or "payroll.xlsx",
            period=period,
        )
    except payroll_reconcile_service.PayrollReconcileRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ReconcilePayrollResponse(**result)


@router.post("/bonus-calculation", response_model=CalculateBonusResponse)
async def calculate_bonus(
    currentYearFile: UploadFile = File(...),
    previousYearSummaryFile: UploadFile = File(...),
    year: str = Form(...),
):
    current_year_content = await currentYearFile.read()
    previous_year_summary_content = await previousYearSummaryFile.read()

    try:
        result = bonus_service.calculate_bonus(
            current_year_content=current_year_content,
            previous_year_summary_content=previous_year_summary_content,
            year=year,
        )
    except bonus_service.BonusRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CalculateBonusResponse(**result)


@router.post("/tax-deduction", response_model=CalculateTaxDeductionResponse)
async def calculate_tax_deduction(
    payrollFile: UploadFile = File(...),
    referenceDate: date | None = Form(None),
):
    payroll_content = await payrollFile.read()

    try:
        result = tax_deduction_service.calculate_tax_deduction(
            payroll_content=payroll_content,
            reference_date=referenceDate,
        )
    except tax_deduction_service.TaxDeductionRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CalculateTaxDeductionResponse(**result)
