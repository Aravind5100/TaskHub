from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    # Timezone-aware: datetime.utcnow() is deprecated on 3.12+ and returns a
    # naive value that silently compares wrong against aware datetimes.
    now = datetime.now(timezone.utc)
    to_encode.update(
        {"exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES), "iat": now}
    )
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return user

def get_owned_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Task:
    """Resolve a task the caller owns, or raise.

    Ownership is part of the query rather than a follow-up check so that a new
    endpoint cannot forget it. A task owned by someone else is reported as 404
    rather than 403 on purpose: distinguishing the two would let any caller
    enumerate which task ids exist.
    """
    task = (
        db.query(models.Task)
        .filter(models.Task.id == task_id, models.Task.owner_id == current_user.id)
        .first()
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task