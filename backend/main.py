from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models

from routes import router
from user_profile.routes import router as profile_router
from user_profile.routes import competitions_router

app = FastAPI()

# Create tables on startup
Base.metadata.create_all(bind=engine)

app.include_router(profile_router)
app.include_router(competitions_router)

# Allow requests from your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"status": "Precision Architect API is running"}