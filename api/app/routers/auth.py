import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.database import get_db
from app.models.user import User
from app.models.settings import Settings
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from datetime import timedelta

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        logger.info(f"Registration attempt for email: {user_data.email}, username: {user_data.username}")
        
        # Check if user exists
        existing_user = db.query(User).filter(
            (User.email == user_data.email) | (User.username == user_data.username)
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or username already registered"
            )
        
        # Create user
        logger.debug("Hashing password...")
        hashed_password = get_password_hash(user_data.password)
        logger.debug("Creating user object...")
        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password
        )
        db.add(user)
        logger.debug("Flushing user to get ID...")
        db.flush()  # Flush to get user.id without committing
        
        # Create default settings
        logger.debug(f"Creating settings for user_id: {user.id}")
        settings = Settings(user_id=user.id)
        db.add(settings)
        
        # Commit both user and settings together
        logger.debug("Committing transaction...")
        db.commit()
        db.refresh(user)
        logger.info(f"Successfully registered user: {user.id}")
        
        return user
    except HTTPException:
        # Re-raise HTTP exceptions (like duplicate user)
        raise
    except SQLAlchemyError as e:
        # Rollback any partial changes
        db.rollback()
        # Log database errors for debugging
        error_msg = f"Database error during registration: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error occurred during registration: {str(e)}"
        )
    except Exception as e:
        # Rollback any partial changes
        db.rollback()
        # Log the error for debugging
        error_msg = f"Registration error: {type(e).__name__}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during registration: {str(e)}"
        )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
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
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

