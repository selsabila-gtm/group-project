from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models
import models_teams          # registers Team / TeamMember / TeamInvitation tables
from routes import router    # single aggregated router from routes/
from user_profile.routes import router as profile_router
from user_profile.routes import competitions_router


app = FastAPI(title="Precision Architect API")

# Create tables on startup (better practice)
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(router)
app.include_router(profile_router)
app.include_router(competitions_router)

@app.get("/")
def root():
    return {"status": "Precision Architect API is running"}