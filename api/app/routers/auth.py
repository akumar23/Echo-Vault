import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.database import get_db
from app.models.settings import Settings as UserSettings
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.services.token_store import token_store

logger = logging.getLogger(__name__)

router = APIRouter()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    cookie_kwargs = dict(
        httponly=True,
        samesite=settings.cookie_same_site,
        secure=settings.cookie_secure,
        path="/",
    )
    response.set_cookie(
        "access_token",
        access_token,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        **cookie_kwargs,
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=settings.jwt_refresh_token_expire_days * 86400,
        **cookie_kwargs,
    )


def _clear_auth_cookies(response: Response) -> None:
    cookie_kwargs = dict(
        httponly=True,
        samesite=settings.cookie_same_site,
        secure=settings.cookie_secure,
        path="/",
    )
    response.delete_cookie("access_token", **cookie_kwargs)
    response.delete_cookie("refresh_token", **cookie_kwargs)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        logger.info(f"Registration attempt for email: {user_data.email}, username: {user_data.username}")

        existing_user = db.query(User).filter(
            (User.email == user_data.email) | (User.username == user_data.username)
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or username already registered"
            )

        hashed_password = get_password_hash(user_data.password)
        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password,
        )
        db.add(user)
        db.flush()

        default_settings = UserSettings(user_id=user.id)
        db.add(default_settings)
        db.commit()
        db.refresh(user)
        logger.info(f"Successfully registered user: {user.id}")
        return user

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during registration: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="A database error occurred during registration. Please try again."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Registration error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during registration. Please try again."
        )


@router.post("/login")
@limiter.limit("5/minute;20/hour")
async def login(
    request: Request,
    response: Response,
    credentials: UserLogin,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = generate_refresh_token()
    token_store.store_refresh_token(hash_token(refresh_token), user.id)
    _set_auth_cookies(response, access_token, refresh_token)

    return {"message": "Login successful"}


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Issue a new access token cookie using the refresh token cookie."""
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    user_id = token_store.validate_refresh_token(hash_token(refresh_token_value))
    if user_id is None:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_access_token = create_access_token(data={"sub": str(user.id)})
    response.set_cookie(
        "access_token",
        new_access_token,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        httponly=True,
        samesite=settings.cookie_same_site,
        secure=settings.cookie_secure,
        path="/",
    )
    return {"message": "Token refreshed"}


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Revoke the refresh token and clear auth cookies."""
    refresh_token_value = request.cookies.get("refresh_token")
    if refresh_token_value:
        token_store.revoke_refresh_token(hash_token(refresh_token_value))
    _clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.get("/ws-ticket")
async def get_ws_ticket(current_user: User = Depends(get_current_user)):
    """Issue a one-time WebSocket auth ticket valid for 60 seconds."""
    ticket = token_store.create_ws_ticket(current_user.id)
    return {"ticket": ticket}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user
