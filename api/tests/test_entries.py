import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


@pytest.fixture
def auth_token():
    # Register and get token
    client.post(
        "/auth/register",
        json={
            "email": "entries@example.com",
            "username": "entriesuser",
            "password": "testpass123"
        }
    )
    response = client.post(
        "/auth/login",
        json={
            "email": "entries@example.com",
            "password": "testpass123"
        }
    )
    return response.json()["access_token"]


def test_create_entry(auth_token):
    response = client.post(
        "/entries",
        json={
            "title": "Test Entry",
            "content": "This is a test entry",
            "tags": ["test", "example"],
            "mood_user": 4
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Entry"
    assert data["content"] == "This is a test entry"
    assert data["tags"] == ["test", "example"]
    assert data["mood_user"] == 4


def test_list_entries(auth_token):
    # Create an entry first
    client.post(
        "/entries",
        json={
            "content": "Test entry for listing",
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    # List entries
    response = client.get(
        "/entries",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_entry(auth_token):
    # Create an entry
    create_response = client.post(
        "/entries",
        json={
            "title": "Get Test",
            "content": "Content for get test",
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    entry_id = create_response.json()["id"]
    
    # Get the entry
    response = client.get(
        f"/entries/{entry_id}",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == entry_id
    assert data["title"] == "Get Test"


def test_update_entry(auth_token):
    # Create an entry
    create_response = client.post(
        "/entries",
        json={
            "title": "Update Test",
            "content": "Original content",
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    entry_id = create_response.json()["id"]
    
    # Update the entry
    response = client.put(
        f"/entries/{entry_id}",
        json={
            "title": "Updated Title",
            "content": "Updated content",
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["content"] == "Updated content"

