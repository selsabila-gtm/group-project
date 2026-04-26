from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = "supersecretkey"   # change later
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

