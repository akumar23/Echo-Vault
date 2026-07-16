"""Tests for file → entry upload and the text extraction reader."""

from unittest.mock import patch

import pytest

from app.services.file_reader import (
    FileReaderError,
    extract_text,
    sanitize_filename,
)


def test_extract_txt():
    result = extract_text(b"Dear journal,\nToday was fine.", filename="day.txt")
    assert "Dear journal" in result.text
    assert result.extension == ".txt"
    assert result.truncated is False


def test_extract_rejects_unsupported_extension():
    with pytest.raises(FileReaderError, match="Unsupported"):
        extract_text(b"MZ", filename="virus.exe")


def test_extract_rejects_path_traversal_filename():
    # Basename is taken; extension still validated.
    result = extract_text(b"safe", filename="../../etc/passwd.txt")
    assert result.filename == "passwd.txt"
    assert ".." not in result.filename


def test_sanitize_filename_rejects_empty():
    with pytest.raises(FileReaderError):
        sanitize_filename("...")


def test_extract_html_strips_tags():
    html = b"<html><head><style>x{}</style></head><body><h1>Hi</h1><p>Body</p></body></html>"
    result = extract_text(html, filename="note.html")
    assert "Hi" in result.text
    assert "Body" in result.text
    assert "<h1>" not in result.text
    assert "x{}" not in result.text


def test_extract_pdf_magic_bytes():
    with pytest.raises(FileReaderError, match="valid PDF"):
        extract_text(b"not a pdf", filename="fake.pdf")


def test_extract_empty_file():
    with pytest.raises(FileReaderError, match="empty"):
        extract_text(b"", filename="empty.txt")


def test_upload_txt_creates_entry(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.entries.app_settings.upload_dir", str(tmp_path))

    with patch("app.routers.entries.enqueue_mood_job") as mood:
        response = auth_client.post(
            "/entries/upload",
            files={"file": ("morning.txt", b"Woke up early and felt calm.", "text/plain")},
            data={"title": "Morning notes", "tags": "import,journal", "mood_user": "3"},
        )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["title"] == "Morning notes"
    assert "felt calm" in data["content"]
    assert data["tags"] == ["import", "journal"]
    assert data["mood_user"] == 3
    assert data["attachment"]["filename"] == "morning.txt"
    assert data["truncated"] is False
    mood.assert_called_once_with(data["id"])

    # File landed on disk under the user-scoped directory.
    stored = list(tmp_path.rglob("*_morning.txt"))
    assert len(stored) == 1


def test_upload_rejects_exe(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.entries.app_settings.upload_dir", str(tmp_path))
    response = auth_client.post(
        "/entries/upload",
        files={"file": ("payload.exe", b"MZ....", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "Unsupported" in response.json()["detail"]


def test_upload_defaults_title_from_filename(auth_client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routers.entries.app_settings.upload_dir", str(tmp_path))
    with patch("app.routers.entries.enqueue_mood_job"):
        response = auth_client.post(
            "/entries/upload",
            files={"file": ("my-thoughts.md", b"# Hello\n\nWorld", "text/markdown")},
        )
    assert response.status_code == 201
    assert response.json()["title"] == "my-thoughts"
    assert "Hello" in response.json()["content"]


def test_upload_requires_auth():
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as client:
        response = client.post(
            "/entries/upload",
            files={"file": ("a.txt", b"hi", "text/plain")},
        )
    assert response.status_code in (401, 403)
