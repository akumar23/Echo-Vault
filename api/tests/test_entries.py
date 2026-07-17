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
    original_created_at = create_response.json()["created_at"]

    response = auth_client.put(
        f"/entries/{entry_id}",
        json={"title": "Updated Title", "content": "Updated content"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["content"] == "Updated content"
    assert data["created_at"] == original_created_at


def test_create_entry_with_entry_date(auth_client):
    response = auth_client.post(
        "/entries",
        json={
            "content": "Backdated entry",
            "entry_date": "2024-06-15",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["created_at"].startswith("2024-06-15")


def test_update_entry_date(auth_client):
    create_response = auth_client.post(
        "/entries",
        json={"content": "Date change test"},
    )
    entry_id = create_response.json()["id"]

    response = auth_client.put(
        f"/entries/{entry_id}",
        json={"entry_date": "2023-01-10"},
    )
    assert response.status_code == 200
    assert response.json()["created_at"].startswith("2023-01-10")


def test_reject_future_entry_date(auth_client):
    response = auth_client.post(
        "/entries",
        json={"content": "Future entry", "entry_date": "2099-01-01"},
    )
    assert response.status_code == 422


def test_related_entries_not_found(auth_client):
    response = auth_client.get("/entries/999999/related")
    assert response.status_code == 404


def test_related_entries_prioritize_shared_tags(auth_client):
    shared = auth_client.post(
        "/entries",
        json={"title": "Shared", "content": "Earlier entry", "tags": ["unique-topic"]},
    ).json()
    auth_client.post(
        "/entries",
        json={"title": "Recent fallback", "content": "No shared tag", "tags": []},
    )
    create_response = auth_client.post(
        "/entries",
        json={"title": "Source", "content": "Current entry", "tags": ["unique-topic"]},
    )
    entry_id = create_response.json()["id"]

    response = auth_client.get(f"/entries/{entry_id}/related?k=1")
    assert response.status_code == 200
    assert response.json()[0]["entry_id"] == shared["id"]
    assert response.json()[0]["score"] == 1.0


def test_related_entries_k_validation(auth_client):
    create_response = auth_client.post(
        "/entries",
        json={"content": "anything"},
    )
    entry_id = create_response.json()["id"]

    # k is clamped to [1, 10] via Query validator
    assert auth_client.get(f"/entries/{entry_id}/related?k=0").status_code == 422
    assert auth_client.get(f"/entries/{entry_id}/related?k=11").status_code == 422
    assert auth_client.get(f"/entries/{entry_id}/related?k=5").status_code == 200


def test_keyword_search_ranks_more_matches_first(auth_client):
    auth_client.post(
        "/entries",
        json={"title": "Needle needle", "content": "needle appears again"},
    )
    auth_client.post(
        "/entries",
        json={"title": "One needle", "content": "otherwise unrelated"},
    )

    response = auth_client.post("/search", json={"query": "needle", "k": 2})

    assert response.status_code == 200
    results = response.json()
    assert len(results) == 2
    assert results[0]["title"] == "Needle needle"
    assert results[0]["score"] > results[1]["score"]
