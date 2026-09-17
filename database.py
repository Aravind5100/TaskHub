#Importing necessary libraries
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from config import DATABASE_URL

#HOW TO CONNECT TO DATABASE
engine=create_engine(DATABASE_URL)
session_local=sessionmaker(autocommit=False,autoflush=False,bind=engine)

Base=declarative_base()

def get_db():
    db = session_local()
    try:
        yield db
    finally:
        db.close()



