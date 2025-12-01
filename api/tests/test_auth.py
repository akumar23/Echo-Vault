import pytest
from fastapi.testclient import TestClient
from app.database import Base, engine, SessionLocal
from main import app

# Create test database
Base.metadata.create_all(bind=engine)

client = TestClient(app)


@pytest.fixture
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_register():
    response = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "testpass123"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["username"] == "testuser"
    assert "id" in data


def test_register_duplicate():
    # Register first time
    client.post(
        "/auth/register",
        json={
            "email": "duplicate@example.com",
            "username": "duplicate",
            "password": "testpass123"
        }
    )
    # Try to register again
    response = client.post(
        "/auth/register",
        json={
            "email": "duplicate@example.com",
            "username": "duplicate2",
            "password": "testpass123"
        }
    )
    assert response.status_code == 400


def test_login():
    # Register first
    client.post(
        "/auth/register",
        json={
            "email": "login@example.com",
            "username": "loginuser",
            "password": "testpass123"
        }
    )
    # Then login
    response = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "testpass123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password():
    # Register first
    client.post(
        "/auth/register",
        json={
            "email": "wrongpass@example.com",
            "username": "wrongpass",
            "password": "testpass123"
        }
    )
    # Try wrong password
    response = client.post(
        "/auth/login",
        json={
            "email": "wrongpass@example.com",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401


def test_full_registration_flow():
    """Test complete registration flow: register -> login -> get user info"""
    # 1. Register a new user
    register_response = client.post(
        "/auth/register",
        json={
            "email": "fullflow@example.com",
            "username": "fullflow",
            "password": "testpass123"
        }
    )
    assert register_response.status_code == 201
    user_data = register_response.json()
    assert user_data["email"] == "fullflow@example.com"
    assert user_data["username"] == "fullflow"
    user_id = user_data["id"]

    # 2. Login with the new user credentials
    login_response = client.post(
        "/auth/login",
        json={
            "email": "fullflow@example.com",
            "password": "testpass123"
        }
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"
    token = login_data["access_token"]

    # 3. Use the token to get user info from /auth/me
    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["id"] == user_id
    assert me_data["email"] == "fullflow@example.com"
    assert me_data["username"] == "fullflow"
    assert me_data["is_active"] is True


def test_get_me_without_token():
    """Test that /auth/me returns 403 when no token is provided"""
    response = client.get("/auth/me")
    assert response.status_code == 403


def test_get_me_with_invalid_token():
    """Test that /auth/me returns 401 with invalid token"""
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token_here"}
    )
    assert response.status_code == 401

