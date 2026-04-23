from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from schemas import UserCreate, UserLogin
from auth import hash_password, verify_password, create_access_token

router = APIRouter()


# DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ✅ SIGNUP
@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    try:
        print("Incoming:", user)

        existing_user = db.query(User).filter(User.email == user.email).first()

        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")

        new_user = User(
            full_name=user.full_name,
            email=user.email,
            password=hash_password(user.password)
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        print("User created!")

        return {"message": "User created successfully"}

    except Exception as e:
        print("🔥 ERROR OCCURRED:", str(e))   # 👈 THIS IS KEY
        raise HTTPException(status_code=500, detail=str(e))