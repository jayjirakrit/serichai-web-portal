from fastapi import APIRouter, File, HTTPException, UploadFile

import services.accounts_service as accounts_service
from models.benefits import CalculateBenefitsResponse

router = APIRouter(
    prefix="/accounts",
    tags=["Accounts"]
)


@router.post("/employee-benefits", response_model=CalculateBenefitsResponse)
async def calculate_employee_benefits(masterFile: UploadFile = File(...)):
    master_content = await masterFile.read()

    try:
        result = accounts_service.calculate_benefits(
            master_content=master_content,
            master_filename=masterFile.filename or "master.xlsx",
        )
    except accounts_service.BenefitsRequestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CalculateBenefitsResponse(**result)
