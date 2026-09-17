from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional

# bcrypt hashes at most the first 72 *bytes* of a password and silently ignores
# the rest, so the limit has to be checked in bytes rather than characters.
BCRYPT_MAX_BYTES = 72

TITLE_MAX = 200
DESCRIPTION_MAX = 2000

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def within_bcrypt_limit(cls, value: str) -> str:
        if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
            raise ValueError(
                f"password must be at most {BCRYPT_MAX_BYTES} bytes "
                "(non-ASCII characters count as more than one)"
            )
        return value

class UserResponse(BaseModel):
    id: int
    username: str

    model_config = ConfigDict(from_attributes=True)

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=TITLE_MAX)
    description: Optional[str] = Field(None, max_length=DESCRIPTION_MAX)

class TaskUpdate(BaseModel):
    # Same bounds as TaskCreate: without them an update could write an empty
    # title that create would have rejected.
    title: Optional[str] = Field(None, min_length=1, max_length=TITLE_MAX)
    description: Optional[str] = Field(None, max_length=DESCRIPTION_MAX)
    completed: Optional[bool] = None

    # description is nullable in the database, so an explicit null legitimately
    # clears it. title and completed are not, so reject an explicit null rather
    # than letting it reach the database. Pydantic does not validate defaults,
    # so this only fires when the client actually sent the field.
    @field_validator("title", "completed")
    @classmethod
    def not_explicitly_null(cls, value, info):
        if value is None:
            raise ValueError(f"{info.field_name} may be omitted, but must not be null")
        return value


class TaskResponse(BaseModel):
    # owner_id is intentionally omitted: a caller can only ever see its own
    # tasks, so it carries no information and is an internal foreign key.
    id: int
    title: str
    description: Optional[str] = None
    completed: bool

    model_config = ConfigDict(from_attributes=True)