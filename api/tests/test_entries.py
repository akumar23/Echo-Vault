import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def auth_client():
    """Returns an authenticated TestClient (cookie-based session)."""
    with TestClient(app) as session_client:
        session_client.post(
            "/auth/register",
            json={
                "email": "entries@example.com",
                "username": "entriesuser",
                "password": "testpass123"
            }
        )
        session_client.post(
            "/auth/login",
            json={"email": "entries@example.com", "password": "testpass123"}
        )
        yield session_client


def test_create_entry(auth_client):
    response = auth_client.post(
        "/entries",
        json={
            "title": "Test Entry",
            "content": "This is a test entry",
            "tags": ["test", "example"],
            "mood_user": 4
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Entry"
    assert data["content"] == "This is a test entry"
    assert data["tags"] == ["test", "example"]
    assert data["mood_user"] == 4


def test_list_entries(auth_client):
    auth_client.post("/entries", json={"content": "Test entry for listing"})
    response = auth_client.get("/entries")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_entry(auth_client):
    create_response = auth_client.post(
        "/entries",
        json={"title": "Get Test", "content": "Content for get test"},
    )
    entry_id = create_response.json()["id"]

    response = auth_client.get(f"/entries/{entry_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == entry_id
    assert data["title"] == "Get Test"


def test_update_entry(auth_client):
    create_response = auth_client.post(
        "/entries",
        json={"title": "Update Test", "content": "Original content"},
    )
    entry_id = create_response.json()["id"]

    response = auth_client.put(
        f"/entries/{entry_id}",
        json={"title": "Updated Title", "content": "Updated content"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["content"] == "Updated content"
