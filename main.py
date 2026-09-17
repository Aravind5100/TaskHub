from database import Base, engine, get_db
from fastapi import FastAPI, Depends,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from schemas import TaskCreate, TaskResponse, TaskUpdate, UserCreate, UserResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from auth import hash_password, verify_password, create_access_token, get_current_user, get_owned_task
import models

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TaskHub",
    description="A personal task manager API. Users register, log in for a JWT, "
    "and manage tasks that only they can see.",
    version="0.1.0",
)

# The frontend (taskhub-ui) is a separate Vite dev server on a different
# origin, so the browser enforces CORS on every request it makes here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to TaskHub API. Visit /docs for the interactive API documentation."} 

@app.post("/tasks/", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_task = models.Task(title=task.title, description=task.description, owner_id=current_user.id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/tasks/", response_model=list[TaskResponse])
def read_tasks(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()
    return tasks

@app.get("/tasks/{task_id}", response_model=TaskResponse)
def read_task(task: models.Task = Depends(get_owned_task)):
    return task

@app.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task: TaskUpdate, db_task: models.Task = Depends(get_owned_task), db: Session = Depends(get_db)):
    # exclude_unset distinguishes "field omitted" from "field explicitly null",
    # so a description can actually be cleared. Adding a field to TaskUpdate no
    # longer requires remembering to add a branch here.
    for field, value in task.model_dump(exclude_unset=True).items():
        setattr(db_task, field, value)
    db.commit()
    db.refresh(db_task)
    return db_task


@app.delete("/tasks/{task_id}")
def delete_task(db_task: models.Task = Depends(get_owned_task), db: Session = Depends(get_db)):
    db.delete(db_task)
    db.commit()
    return {"detail": "Task deleted successfully"}

@app.post("/users/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == user.username).first():
        raise HTTPException(status_code=409, detail="Username already registered")

    db_user = models.User(
        username=user.username, hashed_password=hash_password(user.password)
    )
    db.add(db_user)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent signup for the same username; the unique
        # constraint is the real guarantee, the check above is just for a clean error.
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already registered")
    db.refresh(db_user)
    return db_user

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == form_data.username).first()

    if db_user is None or not verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    access_token = create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer"}