import pytest
from fastapi.testclient import TestClient
from app.database import Base, engine, SessionLocal
from main import app

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
    client.post(
        "/auth/register",
        json={
            "email": "duplicate@example.com",
            "username": "duplicate",
            "password": "testpass123"
        }
    )
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
    client.post(
        "/auth/register",
        json={
            "email": "login@example.com",
            "username": "loginuser",
            "password": "testpass123"
        }
    )
    response = client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "testpass123"}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Login successful"
    # Auth is now delivered via httpOnly cookies, not response body
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


def test_login_wrong_password():
    client.post(
        "/auth/register",
        json={
            "email": "wrongpass@example.com",
            "username": "wrongpass",
            "password": "testpass123"
        }
    )
    response = client.post(
        "/auth/login",
        json={"email": "wrongpass@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_full_registration_flow():
    """Test complete registration flow: register -> login (cookie) -> get user info"""
    with TestClient(app) as session_client:
        register_response = session_client.post(
            "/auth/register",
            json={
                "email": "fullflow@example.com",
                "username": "fullflow",
                "password": "testpass123"
            }
        )
        assert register_response.status_code == 201
        user_data = register_response.json()
        user_id = user_data["id"]

        login_response = session_client.post(
            "/auth/login",
            json={"email": "fullflow@example.com", "password": "testpass123"}
        )
        assert login_response.status_code == 200
        # Cookie is now set in the session
        assert "access_token" in login_response.cookies

        # /auth/me uses the cookie automatically
        me_response = session_client.get("/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["id"] == user_id
        assert me_data["email"] == "fullflow@example.com"
        assert me_data["is_active"] is True


def test_get_me_without_token():
    with TestClient(app) as fresh_client:
        response = fresh_client.get("/auth/me")
        assert response.status_code == 401


def test_get_me_with_invalid_token():
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid_token_here"}
    )
    assert response.status_code == 401
