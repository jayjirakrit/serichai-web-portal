import base64
import io
from dataclasses import dataclass, field
from datetime import date, datetime

import pandas as pd
from openpyxl import Workbook

from util import be_dates

RESIGNED_MARKER = "ลาออก"
ELIGIBILITY_AGE = 35
RETIREMENT_AGE = 60
YEAR_END = date(date.today().year, 12, 31)

COLUMN_ALIASES: dict[str, list[str]] = {
    "id": ["รหัสพนักงาน", "รหัส", "Employee ID", "employee_id"],
    "prefix": ["คำนำหน้า"],
    "first_name": ["ชื่อ"],
    "last_name": ["สกุล", "นามสกุล"],
    "date_of_birth": ["วันเดือนปีเกิด"],
    "start_date": ["เริ่มทำงาน", "วันที่เริ่มทำงาน"],
    "status": ["สถานะ"],
    "current_salary": ["เงินเดือน ณ สิ้นปีปัจจุบัน", "เงินเดือน", "อัตราค่าแรง"],
}


def current_cycle_be_year() -> int:
    return datetime.now().year + 543


def calculate_benefits(employee_content: bytes, master_content: bytes, previous_content: bytes) -> dict:
    employee_df = pd.read_excel(io.BytesIO(employee_content))
    master_df1 = pd.read_excel(io.BytesIO(master_content))
    previous_df = pd.read_excel(io.BytesIO(previous_content))

    master_df = pd.DataFrame(columns=[
        "ลำดับ",
        "คำนำหน้า",
        "ชื่อ",
        "นามสกุล",
        "วันเดือนปีเกิด",
        "วันที่เริ่มทำงาน",
        "เงินเดือน ณ สิ้นปีปัจจุบัน",
        "วันที่เกษียณ (อายุครบ 60)",
        "อายุปัจจุบัน",
        "อายุงานถึงปีเกษียณ",
        "อายุงานถึงปีปัจจุบัน",
        "อายุงานคงเหลือ",
        "เงินเดือน ณ วันเกษียณ",
        "ผลประโยชน์ของพนักงานที่ต้องจ่าย ณ วันเกษียณ",
        "ความน่าจะเป็นในการอยู่จนถึงวันเกษียณ",
        "ประมาณการหนี้สินผลประโยชน์พนักงานที่คาดว่าจะต้องจ่าย ณ วันเกษียณ",
        "ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน",
        "ยอดยกมา",
        "ต้นทุน",
        "คชจ.บริหาร",
        "คชจ.ขาย",
        "ลาออก",
        "อายุงาน (ปี/เดือน)",
        "อายุ (ปี/เดือน)",
        "สถานะ",
    ])
    
    master_df["ลำดับ"] = employee_df["ลำดับ"]
    master_df["คำนำหน้า"] = employee_df["คำนำหน้า"]
    master_df["ชื่อ"] = employee_df["ชื่อ"]
    master_df["นามสกุล"] = employee_df["นามสกุล"]
    master_df["เงินเดือน ณ สิ้นปีปัจจุบัน"] = employee_df["อัตราค่าแรง"]
    master_df["วันเดือนปีเกิด"] = employee_df["วันเดือนปีเกิด"]
    master_df["วันที่เริ่มทำงาน"] = employee_df["เริ่มทำงาน"]
    master_df["เงินเดือน ณ สิ้นปีปัจจุบัน"] = employee_df["เงินเดือน ณ สิ้นปีปัจจุบัน"]
    master_df["วันที่เกษียณ (อายุครบ 60)"] = master_df["วันเดือนปีเกิด"] + pd.to_timedelta((RETIREMENT_AGE * 365), unit='D')
    master_df["อายุปัจจุบัน"] = (YEAR_END - master_df["วันเดือนปีเกิด"]).dt.days // 365
    master_df["อายุงานถึงปีเกษียณ"] = master_df["วันที่เกษียณ (อายุครบ 60)"] - master_df["วันที่เริ่มทำงาน"]
    master_df["อายุงานถึงปีปัจจุบัน"] = (YEAR_END - master_df["วันที่เริ่มทำงาน"]).dt.days // 365
    master_df["อายุงานคงเหลือ"] = master_df["อายุงานถึงปีเกษียณ"] - master_df["อายุงานถึงปีปัจจุบัน"]
    master_df["เงินเดือน ณ วันเกษียณ"] = (1.03 ** master_df["อายุงานคงเหลือ"]) * master_df["เงินเดือน ณ สิ้นปีปัจจุบัน"]
    master_df["ผลประโยชน์ของพนักงานที่ต้องจ่าย ณ วันเกษียณ"] = employee_df["เงินเดือน ณ สิ้นปีปัจจุบัน"]
    master_df["ประมาณการหนี้สินผลประโยชน์พนักงานที่คาดว่าจะต้องจ่าย ณ วันเกษียณ"] = employee_df["เงินเดือน ณ สิ้นปีปัจจุบัน"]
    master_df["ผลประโยชน์ของพนักงานที่คาดว่าต้องจ่าย ณ วันสิ้นปีปัจจุบัน"] = employee_df["เงินเดือน ณ สิ้นปีปัจจุบัน"]
    master_df["สถานะ"] = employee_df["สถานะ"]

    # Perform calculations and return results
    # This is a placeholder for the actual calculation logic
    return {
        "summary": {
            "total_employees_out": len(employee_df),
            "matched_count": 0,
            "new_eligible_count": 0,
            "resigned_flagged_count": 0,
            "exception_count": 0,
            "exceptions_by_category": {},
        },
        "exceptions": [],
        "employee_benefits_report": {
            "filename": "employee_benefits_report.xlsx",
            "content_base64": base64.b64encode(b"dummy content").decode("utf-8"),
        },
        "exception_report": {
            "filename": "exception_report.xlsx",
            "content_base64": base64.b64encode(b"dummy content").decode("utf-8"),
        },
    }
