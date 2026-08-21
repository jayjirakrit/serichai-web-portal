from fastapi import APIRouter, File, HTTPException, UploadFile

import services.accounts_service as accounts_service
from models.benefits import CalculateBenefitsResponse

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
