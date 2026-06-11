"""At-rest encryption for entry text and LLM tokens."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.encryption import (
    _CONTENT_PREFIX,
    ContentDecryptionError,
    decrypt_content,
    encrypt_content,
    encrypt_token,
    is_encrypted_at_rest,
)
from app.core.security import get_password_hash
from app.database import Base, SessionLocal, engine
from app.models.entry import Entry
from app.models.user import User


def test_encrypt_content_roundtrip():
    plaintext = "Dear diary, today was good."
    stored = encrypt_content(plaintext)
    assert stored.startswith(_CONTENT_PREFIX)
    assert decrypt_content(stored) == plaintext


def test_legacy_plaintext_passthrough():
    assert decrypt_content("still plain text") == "still plain text"
    assert is_encrypted_at_rest("still plain text") is False


def test_is_encrypted_at_rest():
    assert is_encrypted_at_rest(encrypt_content("x")) is True
    assert is_encrypted_at_rest(None) is False
    assert is_encrypted_at_rest("") is False


def test_encrypt_token_roundtrip():
    stored = encrypt_token("sk-test-token")
    assert stored.startswith("enc:")
    from app.core.encryption import decrypt_token

    assert decrypt_token(stored) == "sk-test-token"


@pytest.fixture
def persisted_entry_id():
    """Insert an entry via ORM (encrypt on write) without hitting the HTTP API."""
    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError:
        pytest.skip("PostgreSQL not available")
    db = SessionLocal()
    try:
        user = User(
            email="encrypt-test@example.com",
            username="encrypttestuser",
            hashed_password=get_password_hash("testpass123"),
        )
        db.add(user)
        db.flush()
        entry = Entry(
            user_id=user.id,
            title="Secret",
            content="Nobody should read this in Neon.",
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        entry_id, user_id = entry.id, user.id
        yield entry_id
        # Clean up so the unique email doesn't collide on the next test/run.
        db.query(Entry).filter(Entry.id == entry_id).delete()
        db.query(User).filter(User.id == user_id).delete()
        db.commit()
    finally:
        db.close()


def test_entry_persisted_encrypted_at_rest(persisted_entry_id):
    """ORM decrypts on read; raw SQL shows encv1 ciphertext in Postgres."""
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT title, content FROM entries WHERE id = :id"),
            {"id": persisted_entry_id},
        ).one()
        assert row.title.startswith(_CONTENT_PREFIX)
        assert row.content.startswith(_CONTENT_PREFIX)
        assert "Nobody should read this" not in row.content
    finally:
        db.close()


def test_orm_decrypts_on_read(persisted_entry_id):
    db = SessionLocal()
    try:
        entry = db.query(Entry).filter(Entry.id == persisted_entry_id).one()
        assert entry.content == "Nobody should read this in Neon."
        assert entry.title == "Secret"
    finally:
        db.close()


def test_decrypt_without_key_raises():
    ciphertext = encrypt_content("lost key test")
    # Simulate production misconfiguration: ciphertext present, key missing.
    import app.core.config as config_module
    import app.core.encryption as enc_module

    original = config_module.settings.encryption_key
    config_module.settings.encryption_key = ""
    enc_module.settings.encryption_key = ""
    try:
        with pytest.raises(ContentDecryptionError):
            decrypt_content(ciphertext)
    finally:
        config_module.settings.encryption_key = original
        enc_module.settings.encryption_key = original
