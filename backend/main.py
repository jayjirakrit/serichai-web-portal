from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import accounts_router

app = FastAPI()
app.include_router(accounts_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
