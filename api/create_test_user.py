#!/usr/bin/env python3
"""
Create a test user for development
"""
from app.database import SessionLocal
from app.models.user import User
from app.models.settings import Settings
from app.core.security import get_password_hash

def create_test_user():
    db = SessionLocal()
    try:
        # Check if user exists
        email = "dev@test.com"
        existing_user = db.query(User).filter(User.email == email).first()

        if existing_user:
            print(f"User with email {email} already exists")
            print(f"ID: {existing_user.id}")
            print(f"Username: {existing_user.username}")
            print(f"Active: {existing_user.is_active}")
            return

        # Create new user
        password = "password123"
        user = User(
            email=email,
            username="devuser",
            hashed_password=get_password_hash(password)
        )
        db.add(user)
        db.flush()

        # Create settings
        settings = Settings(user_id=user.id)
        db.add(settings)

        db.commit()
        db.refresh(user)

        print(f"Test user created successfully!")
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"Username: {user.username}")
        print(f"ID: {user.id}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
