from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime

_MAX_PASSWORD_BYTES = 72  # bcrypt hard limit


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > _MAX_PASSWORD_BYTES:
            raise ValueError(f"Password must be {_MAX_PASSWORD_BYTES} bytes or fewer")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

