import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import accounts_router

app = FastAPI()
app.include_router(accounts_router)

CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
